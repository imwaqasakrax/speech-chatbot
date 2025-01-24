'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Copy, Check } from 'lucide-react';

const SpeechConverter = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [recognition, setRecognition] = useState(null);

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(stopRecording, 15000);

          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          setTranscribedText(transcript);
        };
        setRecognition(recognition);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#4F46E5';

      ctx.beginPath();
      ctx.moveTo(0, HEIGHT / 2);

      const sliceWidth = WIDTH / (bufferLength - 1);
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (HEIGHT / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = x - sliceWidth;
          const prevY = (dataArray[i - 1] / 128.0) * (HEIGHT / 2);
          const cpX = prevX + (x - prevX) / 2;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }

        x += sliceWidth;
      }

      ctx.shadowColor = '#818CF8';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.stroke();

      ctx.shadowBlur = 0;
    }

    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();

      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      drawWaveform();

      if (recognition) {
        recognition.start();
        setIsRecording(true);

        timeoutRef.current = setTimeout(stopRecording, 15000);
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Speech to Text</h2>
          <div className="space-y-4">
            <div className="flex flex-col items-center space-y-4 relative">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-4 rounded-full transition-all relative z-10 ${
                  isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isRecording ? (
                  <Square className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
              
              {/* Waveform canvas overlaid on mic button */}
              <canvas
                ref={canvasRef}
                width={200}
                height={100}
                className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-xs rounded-lg transition-all duration-300 z-0 ${
                  isRecording ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                  pointerEvents: 'none',
                  maxHeight: isRecording ? '100px' : '0'
                }}
              />
            </div>

            <div className="relative">
              <textarea
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your speech will appear here..."
              />
              <button
                onClick={() => copyToClipboard(transcribedText)}
                className="absolute bottom-2 right-2 p-2 text-gray-500 hover:text-gray-700"
              >
                {isCopied ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechConverter;