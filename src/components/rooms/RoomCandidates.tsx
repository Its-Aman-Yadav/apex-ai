import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../../../config/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Candidate {
  id: string;
  full_name: string;
  last_interaction: string;
  joined_timestamp: number;
  interview_status: string;
  cgpa: number;
  comments: string;
}

export default function RoomCandidates() {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [sortOption, setSortOption] = useState("newest");

  // --- Pagination states ---
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100; // Show 100 candidates per page
  // -------------------------

  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "Please sign in to view candidates",
        });
        navigate("/auth");
        return;
      }

      if (!roomId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Room ID is missing",
        });
        navigate("/");
        return;
      }

      fetchRoomName(roomId);
      fetchCandidates(roomId);
    });

    return () => unsubscribe();
  }, [roomId]);

  const fetchRoomName = async (id: string) => {
    try {
      const roomRef = doc(db, "rooms", id);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        setRoomName(roomSnap.data().name || "Unknown Room");
      } else {
        setRoomName("Unknown Room");
      }
    } catch (error) {
      console.error("Error fetching room name:", error);
      setRoomName("Unknown Room");
    }
  };

  const fetchCandidates = async (id: string) => {
    try {
      setLoading(true);
      const participantsRef = collection(db, "room_participants");
      const participantsQuery = query(
        participantsRef,
        where("room_id", "==", id),
        orderBy("joined_at", "desc")
      );
      const participantsSnapshot = await getDocs(participantsQuery);

      if (participantsSnapshot.empty) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      const fetchedCandidates = await Promise.all(
        participantsSnapshot.docs.map(async (d) => {
          const participantData = d.data();

          // Initialize with CGPA from evaluation_data if available
          let cgpa = 0.0;
          if (participantData.evaluation_data?.cgpa) {
            cgpa = parseFloat(participantData.evaluation_data.cgpa.toFixed(2));
          } else if (participantData.evaluation_data?.evaluation) {
            // Try to extract score from evaluation text if available
            const evaluationText = participantData.evaluation_data.evaluation;
            cgpa = extractScoreFromEvaluation(evaluationText);
          }

          return {
            id: d.id,
            full_name: participantData.full_name || "Unknown",
            last_interaction:
              participantData.joined_at?.toDate().toLocaleString() || "Unknown",
            joined_timestamp: participantData.joined_at?.seconds || 0,
            interview_status: participantData.interview_status || "Completed",
            cgpa: cgpa,
            comments: participantData.comments || "No comments",
          };
        })
      );

      setCandidates(fetchedCandidates);
    } catch (error: any) {
      console.error("Error fetching candidates:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load candidates",
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to extract score from evaluation text using regex
  const extractScoreFromEvaluation = (evaluation: string): number => {
    if (!evaluation) return 0;

    // Patterns like "Overall Score: 8.5" or "Score: 9.1" or "CGPA: 9.0"
    const scorePatterns = [
      /overall\s+score:?\s*([0-9]+\.?[0-9]*)/i,
      /final\s+score:?\s*([0-9]+\.?[0-9]*)/i,
      /score:?\s*([0-9]+\.?[0-9]*)/i,
      /rating:?\s*([0-9]+\.?[0-9]*)/i,
      /grading:?\s*([0-9]+\.?[0-9]*)/i,
      /cgpa:?\s*([0-9]+\.?[0-9]*)/i
    ];

    for (const pattern of scorePatterns) {
      const match = evaluation.match(pattern);
      if (match && match[1]) {
        const extractedScore = parseFloat(match[1]);
        // Ensure the score is within a “reasonable” range (0–10 in this example)
        if (!isNaN(extractedScore) && extractedScore >= 0 && extractedScore <= 10) {
          return parseFloat(extractedScore.toFixed(2));
        }
      }
    }

    return 0;
  };

  const fetchEvaluationData = async (candidate: Candidate) => {
    try {
      setSelectedCandidate(candidate);
      const participantRef = doc(db, "room_participants", candidate.id);
      const participantSnap = await getDoc(participantRef);

      if (participantSnap.exists()) {
        const participantData = participantSnap.data();
        let extractedCGPA = 0.0;
        const evaluationText = participantData.evaluation_data?.evaluation || "";

        // 1. Try to get CGPA from participantData.evaluation_data.cgpa
        if (participantData.evaluation_data?.cgpa) {
          extractedCGPA = parseFloat(participantData.evaluation_data.cgpa.toFixed(2));
        } 
        // 2. If that was 0 or missing, try from the evaluation text
        else if (evaluationText) {
          extractedCGPA = extractScoreFromEvaluation(evaluationText);
        }

        // Update local state with new CGPA
        if (extractedCGPA > 0) {
          setSelectedCandidate((prev) =>
            prev ? { ...prev, cgpa: extractedCGPA } : candidate
          );
          // Update it in the main candidates array
          setCandidates((prevCandidates) =>
            prevCandidates.map((c) =>
              c.id === candidate.id ? { ...c, cgpa: extractedCGPA } : c
            )
          );
        }

        setSelectedEvaluation(evaluationText || "No evaluation data available.");
      } else {
        setSelectedEvaluation("No evaluation data available.");
      }
    } catch (error) {
      console.error("Error fetching evaluation data:", error);
      setSelectedEvaluation("Error loading evaluation data.");
    }
  };

  const formatEvaluation = (evaluation: string | null) => {
    if (!evaluation) {
      return "<div class='p-4 text-center text-gray-500'>No evaluation data available.</div>";
    }

    // Extract sections based on ### headings
    const sections = evaluation.split(/###\s?([^\n]+)/);
    let formattedHtml = "";

    // Process each section (heading and content)
    for (let i = 1; i < sections.length; i += 2) {
      if (i + 1 < sections.length) {
        const heading = sections[i];
        const content = sections[i + 1];

        // Pick heading color based on keywords
        let headingClass = "bg-blue-600"; // Default

        if (/skill|technical|knowledge/i.test(heading)) {
          headingClass = "bg-purple-600";
        } else if (/strength|strong|positive/i.test(heading)) {
          headingClass = "bg-green-600";
        } else if (/weakness|improve|challenge/i.test(heading)) {
          headingClass = "bg-amber-600";
        } else if (/summary|conclusion|overall/i.test(heading)) {
          headingClass = "bg-indigo-600";
        }

        formattedHtml += `
          <div class="mb-6 overflow-hidden rounded-lg shadow bg-white">
            <div class="${headingClass} text-white font-bold py-2 px-4 rounded-t-lg">
              ${heading}
            </div>
            <div class="p-4 bg-gray-50 rounded-b-lg">
              ${content
                .replace(/\*\*(.*?)\*\*/g, "<strong class='text-indigo-800'>$1</strong>")
                .replace(/\n/g, "<br>")
                .replace(/- (.*)/g, "<div class='flex items-start my-1'><div class='text-indigo-500 mr-2'>•</div><div>$1</div></div>")
              }
            </div>
          </div>
        `;
      }
    }
    return formattedHtml;
  };

  const getScoreColor = (score: number) => {
    if (score >= 8.5) return "bg-green-500";
    if (score >= 7) return "bg-blue-500";
    if (score >= 5.5) return "bg-amber-500";
    return "bg-red-500";
  };

  const sortCandidates = (option: string) => {
    let sorted = [...candidates];

    if (option === "newest") {
      sorted.sort((a, b) => b.joined_timestamp - a.joined_timestamp);
    } else if (option === "oldest") {
      sorted.sort((a, b) => a.joined_timestamp - b.joined_timestamp);
    } else if (option === "highest") {
      sorted.sort((a, b) => b.cgpa - a.cgpa);
    } else if (option === "lowest") {
      sorted.sort((a, b) => a.cgpa - b.cgpa);
    }

    setSortOption(option);
    setCandidates(sorted);
    // Reset to page 1 whenever a new sort is selected
    setCurrentPage(1);
  };

  // -------------------------
  // Derive the paginated set
  // -------------------------
  const totalPages = Math.ceil(candidates.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentCandidates = candidates.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{roomName} Candidates</h1>

      {/* Sorting Controls */}
      <div className="mb-6">
        <Select value={sortOption} onValueChange={sortCandidates}>
          <SelectTrigger className="w-64">
            <span>Sort By</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="highest">Highest CGPA</SelectItem>
            <SelectItem value="lowest">Lowest CGPA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <table className="w-full border border-collapse rounded-lg overflow-hidden shadow-lg">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Last Interaction</th>
            <th className="p-3 text-center">Interview Status</th>
            <th className="p-3 text-center">CGPA</th>
            <th className="p-3 text-left">Comments</th>
            <th className="p-3 text-center">Evaluation Report</th>
          </tr>
        </thead>
        <tbody>
          {currentCandidates.map((candidate, index) => (
            <tr
              key={candidate.id}
              className={`${
                index % 2 === 0 ? "bg-white" : "bg-blue-50"
              } hover:bg-blue-100 transition-colors`}
            >
              <td className="p-3 font-medium">{candidate.full_name}</td>
              <td className="p-3 text-sm">{candidate.last_interaction}</td>
              <td className="p-3 text-center">
                <Badge
                  className={`${
                    candidate.interview_status === "Completed"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : candidate.interview_status === "In Progress"
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                  }`}
                >
                  {candidate.interview_status}
                </Badge>
              </td>
              <td className="p-3 text-center">
                <div className="flex justify-center">
                  <div
                    className={`w-12 h-12 rounded-full ${getScoreColor(
                      candidate.cgpa
                    )} text-white flex items-center justify-center font-bold shadow-md`}
                  >
                    {candidate.cgpa.toFixed(1)}
                  </div>
                </div>
              </td>
              <td className="p-3 text-sm">{candidate.comments}</td>
              <td className="p-3 text-center">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-md"
                      onClick={() => fetchEvaluationData(candidate)}
                    >
                      View Report
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto">
                    <DialogTitle className="text-2xl font-bold pb-2 border-b border-gray-200">
                      Evaluation Report
                    </DialogTitle>

                    {/* Show candidate details with the correct CGPA */}
                    {selectedCandidate && selectedCandidate.id === candidate.id && (
                      <div className="flex flex-wrap items-center gap-4 py-4 px-1 mb-4 border-b border-gray-200">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold">
                            {selectedCandidate.full_name}
                          </h3>
                          <p className="text-gray-500 text-sm">
                            {selectedCandidate.last_interaction}
                          </p>
                        </div>
                        <div
                          className={`px-6 py-2 rounded-full ${getScoreColor(
                            selectedCandidate.cgpa
                          )} text-white text-lg font-bold flex items-center justify-center shadow-md`}
                        >
                          Overall Score:{" "}
                          {selectedCandidate.cgpa
                            ? selectedCandidate.cgpa.toFixed(2)
                            : "N/A"}
                        </div>
                      </div>
                    )}

                    {/* Display formatted evaluation details */}
                    <div className="p-2">
                      <div
                        className="text-sm leading-relaxed space-y-2"
                        dangerouslySetInnerHTML={{
                          __html: formatEvaluation(selectedEvaluation),
                        }}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------------------
          Pagination Controls
      ---------------------- */}
      {candidates.length > pageSize && (
        <div className="flex items-center justify-center mt-6 space-x-4">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="font-semibold">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
