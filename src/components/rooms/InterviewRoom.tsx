"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { db } from "../../../config/firebase";


import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Timer, Video, Loader2 } from "lucide-react";


export default function InterviewRoom() {
  // Room details from DB
  const [room, setRoom] = useState(null);
  // const [userId, setUserId] = useState(null);

  const storedEmail = localStorage.getItem("user_email");

  useEffect (() => {
       console.log(storedEmail);
  });

  // Question management
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);

  // Timer management
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  // Media recording
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingChunksRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const [recordingUrl, setRecordingUrl] = useState(null);

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState(null);

  // This is the ref for the <video> element to display camera preview
  const videoRef = useRef(null);

  // Routing and toast
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Keep currentQuestionIndexRef in sync with currentQuestionIndex,
  // so the timer callback always has the latest question index.
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  // On mount: fetch room details, set up the camera, and cleanup on unmount.
  useEffect(() => {
    fetchRoom();
    setupCamera();

    return () => {
      // Stop camera tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      // Clear any running timer
      if (timerRef.current) clearInterval(timerRef.current);
      // Stop recording if it's still going
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error("Error stopping recorder during cleanup:", e);
        }
      }
      // Revoke object URL if it exists
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the room data from Firestore by roomId.
  const fetchRoom = async () => {
    if (!roomId) return;

    try {
      const roomDocRef = doc(db, "rooms", roomId);
      const roomSnapshot = await getDoc(roomDocRef);

      if (!roomSnapshot.exists()) {
        throw new Error("Room not found");
      }

      const data = { id: roomSnapshot.id, ...roomSnapshot.data() };
      setRoom(data);
      // console.log("Room data fetched:", data); // Log room value after it's set
      setTimeLeft(data.time_limit_per_question); // Initialize timer with the room's question time
    } catch (error) {
      console.error("Fetch room error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch room details",
      });
      navigate("/");
    }
  };

  // Set up camera and microphone using getUserMedia.
  const setupCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      setStream(mediaStream);

      // Immediately set the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      console.log("Camera setup successful");
    } catch (error) {
      console.error("Camera error:", error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Failed to access camera and microphone",
      });
    }
  };

  // Attach the camera stream to the video element when either the stream or videoRef changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Start the countdown timer for the current question.
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);

          // Use setTimeout to ensure state updates before running logic
          setTimeout(() => {
            if (
              room &&
              currentQuestionIndexRef.current < room.questions.length - 1
            ) {
              console.log("Time up. Advancing question...");
              advanceQuestion();
            } else {
              console.log("Time up on last question. Completing interview...");
              completeInterview();
            }
          }, 0);

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start a single continuous recording for the entire interview.
  const startInterviewRecording = () => {
    if (!stream) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Camera stream not available",
      });
      return;
    }

    // Mark the interview as started (so we show the first question)
    setHasStarted(true);

    console.log("Starting continuous recording...");
    // Reset chunks using ref to avoid state-related issues
    recordingChunksRef.current = [];

    try {
      // Try different MIME types in order of preference
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];

      let selectedMimeType = "";

      // Find the first supported MIME type
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported MIME types found for recording");
      }

      // console.log(`Using MIME type: ${selectedMimeType}`);

      // Create the MediaRecorder with the supported MIME type
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect recording chunks using ref to avoid state update issues
      mediaRecorder.ondataavailable = (e) => {
        console.log(`Data available: ${e.data.size} bytes`);
        if (e.data && e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      // When the recorder stops, create a downloadable blob and send to OpenAI
      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, preparing download...");

        const chunks = recordingChunksRef.current;
        console.log(`Total chunks: ${chunks.length}`);

        if (chunks.length === 0) {
          console.error("No recording chunks available");
          toast({
            variant: "destructive",
            title: "Error",
            description: "No video data captured. Please try again.",
          });
          setIsSubmitting(false);
          return;
        }

        // Combine all chunks into a single Blob
        const completeBlob = new Blob(chunks, { type: selectedMimeType });
        console.log("Final blob size:", completeBlob.size, "bytes");

        if (completeBlob.size < 1000) {
          // Less than 1KB is likely an error
          toast({
            variant: "destructive",
            title: "Error",
            description:
              "Recording size too small, possible browser issue. Please try a different browser.",
          });
          setIsSubmitting(false);
          return;
        }

        // Create a downloadable URL for the recording
        const url = URL.createObjectURL(completeBlob);
        setRecordingUrl(url);
        setIsCompleted(true);

        // Initiate OpenAI evaluation
        sendToOpenAI(completeBlob);
      };

      // Request data to be delivered every 1 second to avoid large chunks
      mediaRecorder.start(1000);
      setIsRecording(true);
      console.log("MediaRecorder started successfully");

      // Start the timer for the current question
      startTimer();
    } catch (error) {
      console.error("MediaRecorder error:", error);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: `Failed to start recording: ${error.message}`,
      });
      setHasStarted(false);
    }
  };

  // Move to the next question, reset the timer, and keep recording.
  const advanceQuestion = () => {
    setCurrentQuestionIndex((prev) => {
      const newIndex = prev + 1;
      console.log(`Advancing to question ${newIndex + 1}`);
      return newIndex;
    });

    // Reset the timer for the next question
    if (room) {
      setTimeLeft(room.time_limit_per_question);
      // Use a short timeout to ensure the state is updated before restarting the timer
      setTimeout(() => {
        startTimer();
      }, 10);
    }
  };

  // Manually request data and stop
  const requestDataAndStop = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        // Request data explicitly to get the latest chunk
        mediaRecorderRef.current.requestData();

        // Give a moment for the data to be processed
        setTimeout(() => {
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
          ) {
            mediaRecorderRef.current.stop();
            console.log("Recording stopped via completeInterview");
          }
          setIsRecording(false);
        }, 500);
      } catch (error) {
        console.error("Error during requestData/stop:", error);
        // Try a direct stop if requestData fails
        try {
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
          ) {
            mediaRecorderRef.current.stop();
          }
        } catch (stopError) {
          console.error("Error during fallback stop:", stopError);
        }
        setIsRecording(false);
      }
    }
  };

  // Stop recording and handle interview completion
  const completeInterview = async () => {
    if (isSubmitting) return; // prevent duplicate calls
    setIsSubmitting(true);

    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    console.log(
      "Completing interview, media recorder state:",
      mediaRecorderRef.current?.state
    );

    // Stop recording with added reliability
    requestDataAndStop();

    // setTimeout(() => {
    //   navigate("/thank-you");
    // }, 2000);
  };

  const sendToOpenAI = async (videoBlob) => {
    setIsEvaluating(true);

    try {
      // console.log("Starting OpenAI evaluation process...");

      // Step 1: Transcribe the video using Whisper API
      const formData = new FormData();
      formData.append("file", videoBlob, "interview.webm");
      formData.append("model", "whisper-1"); // OpenAI's transcription model

      // console.log("Sending video to OpenAI Whisper API for transcription...");

      const transcriptionResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          },
          body: formData,
        }
      );

      if (!transcriptionResponse.ok) {
        const errorData = await transcriptionResponse.json().catch(() => ({}));
        console.error("Transcription API error:", errorData);
        throw new Error(
          `Transcription API request failed with status ${transcriptionResponse.status}`
        );
      }

      const transcript = await transcriptionResponse.json();
      // console.log("OpenAI Whisper Transcription Results:", transcript);

      // Step 2: Extract the questions from the room data
      const questions = room?.questions?.map((q) => q.text) || [];
      const questionsText = questions
        .map((q, i) => `Question ${i + 1}: ${q}`)
        .join("\n");

      // Step 3: Analyze the transcript using GPT-4 with proper evaluation instructions
      // console.log("Sending transcript to GPT-4 for detailed evaluation...");

      const evaluationPrompt = `
      You are an expert interview coach evaluating an interview response.
      
      ### Evaluation Criteria:
      ${room?.criteria?.map((criterion, index) => 
        `${index + 1}. ${criterion.name} - ${criterion.description} (Weight: ${criterion.maxScore}%)`
      ).join("\n") || "No criteria available"}
      
      ### Interview Questions:
      ${questionsText}
      
      ### Candidate's Response:
      "${transcript.text}"
      
      ### Evaluation Instructions:
      Evaluate the candidate's response objectively based on the criteria above.
      
      ### Your Response Must Follow This Exact Format:
      
      ## Overall Score: [SCORE]/10
      ## CGPA: [CGPA]/10.0
      
      ## Detailed Evaluation:
      
      ${room?.criteria?.map((criterion, index) => `
      ### ${index + 1}. ${criterion.name} - [SCORE]/${criterion.maxScore}
      **Strengths:**
      - [List key strengths in bullet points]
      
      **Areas for Improvement:**
      - [List specific improvement areas in bullet points]
      
      **Recommended Steps:**
      - [Provide 2-3 actionable recommendations in bullet points]
      `).join("\n") || ""}
      `;
      

      const evaluationResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4-turbo-preview", // Using the latest GPT-4 model
            messages: [
              {
                role: "system",
                content:
                  "You are an AI assistant specialized in evaluating interview performances.",
              },
              { role: "user", content: evaluationPrompt },
            ],
            max_tokens: 1000,
            temperature: 0.7,
          }),
        }
      );

      if (!evaluationResponse.ok) {
        const errorData = await evaluationResponse.json().catch(() => ({}));
        // console.error("GPT Evaluation API error:", errorData);
        throw new Error(
          `Evaluation API request failed with status ${evaluationResponse.status}`
        );
      }

      const evaluationData = await evaluationResponse.json();

      // Log the detailed evaluation to console
      // console.log(
      //   "%c OpenAI Interview Evaluation Results",
      //   "background: #4CAF50; color: white; padding: 5px; border-radius: 5px;"
      // );
      // console.log(evaluationData.choices[0].message.content);

      // Store a simplified version of the evaluation results
      // Using only primitive values and avoiding deep nesting to ensure Firestore compatibility
      const evaluationResultsData = {
        transcript: transcript.text.substring(0, 1000), // Limit transcript length
        evaluation: evaluationData.choices[0].message.content,
        model: evaluationData.model || "unknown",
        created: evaluationData.created || Date.now(),
        id: evaluationData.id || "unknown",
        finish_reason: evaluationData.choices[0]?.finish_reason || "unknown",
        completion_tokens: evaluationData.usage?.completion_tokens || 0,
        prompt_tokens: evaluationData.usage?.prompt_tokens || 0,
        total_tokens: evaluationData.usage?.total_tokens || 0,
        timestamp: new Date().toISOString(),
      };

      setEvaluationResults(evaluationResultsData);

      // Add a delay to ensure state updates are complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Store the evaluation data in Firestore with error handling for each step
      try {
        // console.log("Storing evaluation data in Firestore...");

        // Make sure room.id exists before proceeding
        if (!room || !room.id) {
          throw new Error("Room ID is undefined or null");
        }

        // console.log("Room ID for query:", room.id);

        // Find the participant document for this room
        // Find the participant document for this room
        const participantsRef = collection(db, "room_participants");
        const q = query(participantsRef, where("room_id", "==", room.id));

        let querySnapshot;
        try {
          querySnapshot = await getDocs(q);
          // console.log("Query results count:", querySnapshot.size);
        } catch (queryError) {
          console.error("Error querying participants:", queryError);
          throw new Error(
            `Failed to query room participants: ${queryError.message}`
          );
        }

        // Create a sanitized version of the data for Firestore
        // This ensures no undefined values or invalid types
        const safeEvaluationData = {};

        // Only include valid data types that Firestore accepts
        Object.entries(evaluationResultsData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Convert any objects to strings to avoid nested object issues
            if (
              typeof value === "object" &&
              !Array.isArray(value) &&
              !(value instanceof Date)
            ) {
              safeEvaluationData[key] = JSON.stringify(value);
            } else {
              safeEvaluationData[key] = value;
            }
          }
        });

        // console.log("Sanitized data for Firestore:", safeEvaluationData);

        // Check if there's a participant document with a matching room_id that belongs to the current user
        // You'll need to add user identification logic here if not already present
        const participantDoc = querySnapshot.docs.find((doc) => {
          const data = doc.data();
          return data.room_id === room.id && data.email === storedEmail;
          // If you have additional user identification fields like user_id, email, etc.,
          // add them to this comparison
        });

        if (participantDoc) {
          // Update the existing participant document that matches the current user
          try {
            // console.log("Updating document ID:", participantDoc.id);

            await updateDoc(doc(db, "room_participants", participantDoc.id), {
              evaluation_data: safeEvaluationData,
              evaluationResultsData: evaluationResultsData,
              updated_at: new Date(),
            });
            console.log("Successfully updated existing participant document");
          } catch (updateError) {
            console.error("Error updating document:", updateError);
            throw new Error(
              `Failed to update participant document: ${updateError.message}`
            );
          }
        } else {
          // Create a new participant document
          try {
            console.log("Creating new participant document");
            const newDocRef = await addDoc(
              collection(db, "room_participants"),
              {
                room_id: room.id,
                evaluation_data: safeEvaluationData,
                evaluationResultsData: evaluationResultsData,
                created_at: new Date(),
              }
            );
            console.log("Created new document with ID:", newDocRef.id);
          } catch (addError) {
            console.error("Error adding document:", addError);
            throw new Error(
              `Failed to create participant document: ${addError.message}`
            );
          }
        }

        toast({
          title: "Data Saved",
          description:
            "Your interview evaluation has been saved to the database.",
        });
      } catch (firestoreError) {
        // console.error("Firestore storage error:", firestoreError);

        // Try a fallback approach - store minimal data
        try {
          console.log("Attempting fallback storage with minimal data...");
          const minimalData = {
            evaluation: evaluationData.choices[0].message.content,
            timestamp: new Date().toISOString(),
          };

          await addDoc(collection(db, "room_participants"), {
            room_id: room.id,
            minimal_evaluation_data: minimalData,
            evaluationResultsData: evaluationResultsData, // Make sure this line exists
            created_at: new Date(),
            is_fallback: true,
          });

          console.log("Fallback storage successful");

          toast({
            variant: "destructive",
            title: "Partial Data Saved",
            description:
              "Only partial evaluation data could be saved due to technical limitations.",
          });
        } catch (fallbackError) {
          console.error("Even fallback storage failed:", fallbackError);
          toast({
            variant: "destructive",
            title: "Database Error",
            description: `Failed to store evaluation data: ${firestoreError.message}`,
          });
        }
      }

      toast({
        title: "Evaluation Complete",
        description:
          "Your interview has been evaluated successfully. Check the console for detailed feedback.",
      });
    } catch (error) {
      // console.error("OpenAI API error:", error);
      toast({
        variant: "destructive",
        title: "Evaluation Error",
        description: `Failed to evaluate interview: ${error.message}`,
      });
    } finally {
      setIsEvaluating(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">
              {room?.name || "Loading Room..."}
            </h1>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4" />
              <span className="font-mono">{timeLeft}s</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Camera Preview */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {isRecording && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-2 py-1 rounded-md text-sm flex items-center">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                  Recording
                </div>
              )}
            </div>

            {/* Question Display */}
            <div className="space-y-4">
              {hasStarted && room?.questions?.length > 0 ? (
                <>
                  <h2 className="text-xl font-semibold">
                    Question {currentQuestionIndex + 1} of{" "}
                    {room?.questions.length}
                  </h2>
                  <p className="text-lg">
                    {room?.questions[currentQuestionIndex]?.text ||
                      "Loading question..."}
                  </p>
                </>
              ) : (
                <h2 className="text-xl font-semibold">
                  Press "Start Interview" to begin.
                </h2>
              )}
            </div>

            {/* Download section - only shown when interview is completed */}
            {/* {isCompleted && recordingUrl && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold mb-2">Interview Completed!</h3>
                <p className="mb-3">You can now download your recording using the button below.</p>
                <a
                  href={recordingUrl}
                  download={`interview_${roomId}_${Date.now()}.webm`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" /> Download Recording
                </a>
              </div>
            )} */}

            {/* Evaluation status */}
            {isEvaluating && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-yellow-600" />
                  <span>Evaluating your interview, please wait</span>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-between">
              {!hasStarted ? (
                <Button
                  onClick={startInterviewRecording}
                  disabled={!stream || isSubmitting}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Video className="w-4 h-4 mr-2" /> Start Interview
                </Button>
              ) : isCompleted ? (
                <Button onClick={() => navigate("/")} size="lg">
                  Back to Home
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (
                      room &&
                      currentQuestionIndex < room.questions.length - 1
                    ) {
                      console.log("Manual next question clicked");
                      advanceQuestion();
                    } else {
                      console.log("Manual completion triggered");
                      completeInterview();
                    }
                  }}
                  disabled={isSubmitting || isEvaluating}
                  size="lg"
                  className={
                    currentQuestionIndex < (room?.questions?.length || 0) - 1
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-red-600 hover:bg-red-700"
                  }
                >
                  {currentQuestionIndex < (room?.questions?.length || 0) - 1
                    ? "Next Question"
                    : "Complete Interview"}
                </Button>
              )}

              {(isSubmitting || isEvaluating) && (
                <Button disabled size="lg">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEvaluating ? "Evaluating..." : "Processing..."}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
