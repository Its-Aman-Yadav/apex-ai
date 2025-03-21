import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useToast } from "@/components/ui/use-toast";
import CreateRoomForm from "./CreateRoomForm";
import type { Room, Question, Criterion } from "@/types/room";

export default function EditRoom() {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!roomId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Room ID is missing",
      });
      navigate("/");
      return;
    }
    fetchRoom(roomId);
  }, [roomId]);

  const fetchRoom = async (id: string) => {
    try {
      const roomDocRef = doc(db, "rooms", id);
      const roomSnapshot = await getDoc(roomDocRef);
      
      if (!roomSnapshot.exists()) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Room not found",
        });
        navigate("/");
        return;
      }

      const data = roomSnapshot.data();
      
      // Transform the data to match the Room type
      const roomData: Room = {
        ...data,
        id: roomSnapshot.id,
        questions: (data.questions || []) as unknown as Question[],
        criteria: (data.criteria || []) as unknown as Criterion[],
        time_limit_per_question: data.time_limit_per_question || 300,
        is_active: data.is_active ?? true,
        share_id: data.share_id || null,
      };
      
      setRoom(roomData);
    } catch (error: any) {
      console.error("Error fetching room:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load room details",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleRoomUpdated = (updatedRoom: Room) => {
    toast({
      title: "Success",
      description: "Room updated successfully",
    });
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Edit Room</h1>
      {room && (
        <CreateRoomForm
          userId={room.created_by}
          onRoomCreated={handleRoomUpdated}
          initialData={room}
        />
      )}
    </div>
  );
}