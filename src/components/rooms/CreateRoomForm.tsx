import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Question, Criterion, Room } from "@/types/room";
import { db } from "../../../config/firebase";
import { collection, addDoc, updateDoc, doc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

interface CreateRoomFormProps {
  userId: string;
  onRoomCreated: (room: any) => void;
  initialData?: Room;
}

// This hook fetches all rooms and filters by user ID on the client side to avoid index requirements
export function useUserRooms(userId: string) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRooms() {
      try {
        setLoading(true);
        
        // Get all rooms from the collection
        const roomsRef = collection(db, "rooms");
        const querySnapshot = await getDocs(roomsRef);
        
        // Filter rooms by userId on the client side
        const userRooms: Room[] = [];
        querySnapshot.forEach((doc) => {
          const roomData = doc.data() as Omit<Room, 'id'>;
          if (roomData.created_by === userId) {
            userRooms.push({ id: doc.id, ...roomData } as Room);
          }
        });
        
        setRooms(userRooms);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching user rooms:", err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchUserRooms();
    }
  }, [userId]);

  return { rooms, loading, error };
}

export default function CreateRoomForm({ userId, onRoomCreated, initialData }: CreateRoomFormProps) {
  const [roomName, setRoomName] = useState(initialData?.name || "");
  const [roomDescription, setRoomDescription] = useState(initialData?.description || "");
  const [questions, setQuestions] = useState<Question[]>(initialData?.questions || []);
  const [criteria, setCriteria] = useState<Criterion[]>(initialData?.criteria || []);
  const [timeLimit, setTimeLimit] = useState(initialData?.time_limit_per_question || 300);
  const { toast } = useToast();

  const handleAddQuestion = () => { 
    setQuestions([
      ...questions,
      { id: uuidv4(), text: "" },
    ]);
  };
  

  const handleUpdateQuestion = (id: string, text: string) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, text } : q))
    );
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleAddCriterion = () => { 
    setCriteria([
      ...criteria,
      { 
        id: uuidv4(), 
        name: "", 
        description: "", 
        maxScore: 10 
      },
    ]);
  };
  

  const handleUpdateCriterion = (
    id: string, 
    field: keyof Criterion, 
    value: string | number
  ) => {
    setCriteria(
      criteria.map((c) => 
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const handleRemoveCriterion = (id: string) => {
    setCriteria(criteria.filter((c) => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (questions.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add at least one question",
      });
      return;
    }

    if (criteria.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add at least one evaluation criterion",
      });
      return;
    }

    try {
      const roomData = {
        name: roomName,
        description: roomDescription,
        created_by: userId,
        questions: questions,
        criteria: criteria,
        time_limit_per_question: timeLimit,
        created_at: new Date(),
        share_id: initialData?.share_id || uuidv4(),
      };

      if (initialData) {
        // Update existing room
        const roomRef = doc(db, "rooms", initialData.id);
        await updateDoc(roomRef, roomData);
        
        // Return updated room data with id
        const updatedRoom = {
          id: initialData.id,
          ...roomData
        };
        
        onRoomCreated(updatedRoom);
      } else {
        // Create new room
        const roomsCollection = collection(db, "rooms");
        const docRef = await addDoc(roomsCollection, roomData);
        
        // Return created room data with id
        const createdRoom = {
          id: docRef.id,
          ...roomData
        };
        
        onRoomCreated(createdRoom);
      }

      if (!initialData) {
        setRoomName("");
        setRoomDescription("");
        setQuestions([]);
        setCriteria([]);
        setTimeLimit(30);
      }
      
      toast({
        title: "Success",
        description: initialData ? "Room updated successfully" : "Room created successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Room Name</Label>
          <Input 
            id="name" 
            placeholder="Enter room name" 
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea 
            id="description" 
            placeholder="Enter room description" 
            value={roomDescription}
            onChange={(e) => setRoomDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Questions</Label>
          <Button 
            type="button" 
            size="sm" 
            onClick={handleAddQuestion}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </div>
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={question.text}
                  onChange={(e) => handleUpdateQuestion(question.id, e.target.value)}
                  placeholder={`Question ${index + 1}`}
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveQuestion(question.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Time Limit per Question</Label>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <Input
              type="number"
              min={30}
              step={30}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">seconds</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Evaluation Criteria</Label>
          <Button 
            type="button" 
            size="sm" 
            onClick={handleAddCriterion}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Criterion
          </Button>
        </div>
        <div className="space-y-4">
          {criteria.map((criterion) => (
            <div 
              key={criterion.id} 
              className="space-y-2 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <Input
                  value={criterion.name}
                  onChange={(e) => handleUpdateCriterion(criterion.id, "name", e.target.value)}
                  placeholder="Criterion name"
                  className="flex-1 mr-2"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveCriterion(criterion.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                value={criterion.description}
                onChange={(e) => handleUpdateCriterion(criterion.id, "description", e.target.value)}
                placeholder="Describe how this criterion should be evaluated"
                required
              />
              <div className="flex items-center gap-2">
                <Label>Max Score:</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={criterion.maxScore}
                  onChange={(e) => handleUpdateCriterion(criterion.id, "maxScore", Number(e.target.value))}
                  className="w-20"
                  required
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full">
        {initialData ? "Update Room" : "Create Room"}
      </Button>
    </form>
  );
}