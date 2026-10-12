import Foundation
import AppKit
import ScreenCaptureKit
import AVFoundation
import Carbon

private struct Segment {
    let index: Int
    let path: String
    let start: Date
    var end: Date?
}

private let hotkeyHandler: EventHandlerUPP = { _, event, _ in
    var hotkey = EventHotKeyID()
    let status = GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &hotkey)
    if status == noErr {
        let actions: [UInt32: (String, Int?)] = [
            1: ("clip", nil), 2: ("screenshot", nil), 3: ("record", nil),
            4: ("clip", 60), 5: ("clip", 300), 6: ("clip", 900)
        ]
        if let (action, seconds) = actions[hotkey.id] {
            var payload: [String: Any] = ["event": "hotkey", "action": action]
            if let seconds { payload["seconds"] = seconds }
            CaptureAgent.shared?.emit(payload)
        }
    }
    return noErr
}

final class CaptureAgent: NSObject, SCRecordingOutputDelegate, SCStreamDelegate {
    static var shared: CaptureAgent?
    private let directory: URL
    private let displayIndex: Int
    private let maxHeight: Int
    private let fps: Int
    private let systemAudio: Bool
    private let microphone: Bool
    private var stream: SCStream?
    private var output: SCRecordingOutput?
    private var segments: [ObjectIdentifier: Segment] = [:]
    private var flushes: [Int: [String]] = [:]
    private var nextIndex = 0
    private var timer: Timer?
    private var hotkeys: [EventHotKeyRef?] = []

    init(directory: URL, displayIndex: Int, maxHeight: Int, fps: Int, systemAudio: Bool, microphone: Bool) {
        self.directory = directory
        self.displayIndex = displayIndex
        self.maxHeight = maxHeight
        self.fps = fps
        self.systemAudio = systemAudio
        self.microphone = microphone
        super.init()
        Self.shared = self
    }

    func emit(_ value: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys]),
              let line = String(data: data, encoding: .utf8) else { return }
        print(line)
        fflush(stdout)
    }

    func registerHotkeys() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), hotkeyHandler, 1, &eventType, nil, nil)
        let signature: OSType = 0x434D5343
        let bindings: [(Int, Int, Int)] = [
            (1, kVK_ANSI_8, cmdKey | shiftKey),
            (2, kVK_ANSI_9, cmdKey | shiftKey),
            (3, kVK_ANSI_7, cmdKey | shiftKey),
            (4, kVK_ANSI_1, cmdKey | optionKey),
            (5, kVK_ANSI_2, cmdKey | optionKey),
            (6, kVK_ANSI_3, cmdKey | optionKey)
        ]
        for (id, key, modifiers) in bindings {
            var ref: EventHotKeyRef?
            let status = RegisterEventHotKey(UInt32(key), UInt32(modifiers), EventHotKeyID(signature: signature, id: UInt32(id)), GetApplicationEventTarget(), 0, &ref)
            hotkeys.append(ref)
            if status != noErr { emit(["event": "error", "message": "Could not register hotkey \(id): \(status)"]) }
        }
    }

    func start() async {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
            guard !content.displays.isEmpty else { throw NSError(domain: "ClipMyScreen", code: 1, userInfo: [NSLocalizedDescriptionKey: "No display available"]) }
            let displayOptions: [[String: Any]] = content.displays.enumerated().map { index, screen in
                let screenshotDisplay = NSScreen.screens.firstIndex { candidate in
                    (candidate.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value == screen.displayID
                }.map { $0 + 1 } ?? index + 1
                return ["index": index, "id": screen.displayID, "width": screen.width, "height": screen.height,
                 "main": screen.displayID == CGMainDisplayID(), "screenshotDisplay": screenshotDisplay]
            }
            emit(["event": "displays", "displays": displayOptions])
            guard content.displays.indices.contains(displayIndex) else {
                throw NSError(domain: "ClipMyScreen", code: 2, userInfo: [NSLocalizedDescriptionKey: "Selected display is no longer available. Choose another screen in Settings."])
            }
            let display = content.displays[displayIndex]
            let scale = min(1.0, Double(maxHeight) / Double(display.height))
            let width = max(2, Int(Double(display.width) * scale) & ~1)
            let height = max(2, Int(Double(display.height) * scale) & ~1)
            let config = SCStreamConfiguration()
            config.width = width
            config.height = height
            config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(fps))
            config.queueDepth = 6
            config.showsCursor = true
            config.capturesAudio = systemAudio
            config.captureMicrophone = microphone
            config.excludesCurrentProcessAudio = true
            let filter = SCContentFilter(display: display, excludingWindows: [])
            let stream = SCStream(filter: filter, configuration: config, delegate: self)
            self.stream = stream
            addOutput()
            try await stream.startCapture()
            emit(["event": "ready", "width": width, "height": height, "fps": fps, "displayCount": content.displays.count, "displayIndex": displayIndex, "displays": displayOptions])
            let rotationTimer = Timer(timeInterval: 4, repeats: true) { [weak self] _ in self?.rotate() }
            RunLoop.main.add(rotationTimer, forMode: .common)
            timer = rotationTimer
        } catch {
            emit(["event": "error", "message": error.localizedDescription])
        }
    }

    private func addOutput() {
        guard let stream else { return }
        let index = nextIndex
        nextIndex += 1
        let path = directory.appendingPathComponent(String(format: "segment-%08d.mp4", index)).path
        let configuration = SCRecordingOutputConfiguration()
        configuration.outputURL = URL(fileURLWithPath: path)
        configuration.videoCodecType = .h264
        configuration.outputFileType = .mp4
        let output = SCRecordingOutput(configuration: configuration, delegate: self)
        do {
            try stream.addRecordingOutput(output)
            segments[ObjectIdentifier(output)] = Segment(index: index, path: path, start: Date())
            self.output = output
        } catch {
            emit(["event": "error", "message": "Recorder failed: \(error.localizedDescription)"])
        }
    }

    func rotate(flushId: String? = nil) {
        guard let stream, let output else { return }
        let key = ObjectIdentifier(output)
        if let flushId, let index = segments[key]?.index { flushes[index, default: []].append(flushId) }
        segments[key]?.end = Date()
        do {
            try stream.removeRecordingOutput(output)
            self.output = nil
            // ScreenCaptureKit sometimes finalizes the file without sending the
            // optional finish delegate callback. Give the MP4 time to close,
            // then advance even if that callback never arrives.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.finishSegment(output) }
        } catch {
            emit(["event": "error", "message": "Recorder rotation failed: \(error.localizedDescription)"])
        }
    }

    func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) {
        DispatchQueue.main.async { self.finishSegment(recordingOutput) }
    }

    private func finishSegment(_ recordingOutput: SCRecordingOutput) {
        let key = ObjectIdentifier(recordingOutput)
        guard let segment = segments.removeValue(forKey: key) else { return }
        emit(["event": "segment", "index": segment.index, "path": segment.path, "start": segment.start.timeIntervalSince1970, "end": (segment.end ?? Date()).timeIntervalSince1970])
        for id in flushes.removeValue(forKey: segment.index) ?? [] {
            emit(["event": "flushed", "id": id, "index": segment.index])
        }
        if output == nil { addOutput() }
    }

    func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) {
        DispatchQueue.main.async {
            let key = ObjectIdentifier(recordingOutput)
            if let segment = self.segments.removeValue(forKey: key) {
                for id in self.flushes.removeValue(forKey: segment.index) ?? [] { self.emit(["event": "flushError", "id": id, "message": error.localizedDescription]) }
            }
            self.emit(["event": "error", "message": "Recording failed: \(error.localizedDescription)"])
            exit(2)
        }
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        emit(["event": "error", "message": "Screen capture stopped: \(error.localizedDescription)"])
        exit(2)
    }

    func handle(_ line: String) {
        guard let data = line.data(using: .utf8),
              let command = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let action = command["action"] as? String else { return }
        if action == "flush" { rotate(flushId: command["id"] as? String) }
        if action == "quit" {
            timer?.invalidate()
            Task { try? await stream?.stopCapture(); exit(0) }
        }
    }
}

let arguments = CommandLine.arguments
func argument(_ name: String, fallback: String) -> String {
    guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else { return fallback }
    return arguments[index + 1]
}
let directory = URL(fileURLWithPath: argument("--dir", fallback: NSTemporaryDirectory()), isDirectory: true)
let agent = CaptureAgent(directory: directory,
                         displayIndex: Int(argument("--display", fallback: "0")) ?? 0,
                         maxHeight: Int(argument("--height", fallback: "1080")) ?? 1080,
                         fps: Int(argument("--fps", fallback: "30")) ?? 30,
                         systemAudio: argument("--audio", fallback: "true") == "true",
                         microphone: argument("--mic", fallback: "false") == "true")
agent.registerHotkeys()
Task { await agent.start() }
DispatchQueue.global(qos: .utility).async {
    while let line = readLine() { DispatchQueue.main.async { agent.handle(line) } }
}
RunLoop.main.run()
