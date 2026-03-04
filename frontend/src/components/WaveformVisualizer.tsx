"use client";

interface WaveformVisualizerProps {
  active: boolean;
}

export default function WaveformVisualizer({ active }: WaveformVisualizerProps) {
  return (
    <div className="flex items-center justify-center gap-1 h-10">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${
            active
              ? "bg-teal-500 waveform-bar"
              : "bg-gray-300 h-2"
          }`}
          style={active ? undefined : { height: "8px" }}
        />
      ))}
    </div>
  );
}
