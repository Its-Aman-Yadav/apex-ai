import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { db } from "../../../config/firebase";

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  limit,
  serverTimestamp
} from "firebase/firestore";

export default function JoinRoom() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Fetch the room ID using share_id
      const roomsRef = collection(db, "rooms");
      const q = query(roomsRef, where("share_id", "==", shareId), limit(1));
      const roomSnapshot = await getDocs(q);
      
      if (roomSnapshot.empty) {
        throw new Error("Room not found");
      }

      const roomData = {
        id: roomSnapshot.docs[0].id,
        ...roomSnapshot.docs[0].data()
      };

      // console.log("Room Data:", roomData);

      // 2. Check if the user's profile already exists
      const profilesRef = collection(db, "profiles");
      const profileQuery = query(profilesRef, where("email", "==", email), limit(1));
      const profileSnapshot = await getDocs(profileQuery);
      
      let profileData;
      
      if (profileSnapshot.empty) {
        // Create a new profile if one doesn't exist
        const newProfileRef = await addDoc(collection(db, "profiles"), { 
          email, 
          full_name: fullName,
          created_at: serverTimestamp()
        });

        
        
        
        // Fetch the newly created profile data
        const newProfileDoc = await getDoc(newProfileRef);
        profileData = {
          id: newProfileRef.id,
          ...newProfileDoc.data()
        };
      } else {
        profileData = {
          id: profileSnapshot.docs[0].id,
          ...profileSnapshot.docs[0].data()
        };
      }

      // console.log("Profile Data:", profileData);

      // 3. Check if this user has already joined the room
      const participantsRef = collection(db, "room_participants");
      const participantQuery = query(
        participantsRef, 
        where("room_id", "==", roomData.id),
        where("user_id", "==", profileData.id),
        limit(1)
      );
      
      const participantSnapshot = await getDocs(participantQuery);

      if (!participantSnapshot.empty) {
        // If they already exist, show the message
        throw new Error("You have already given the interview");
      }

      if (profileData) {
        localStorage.setItem("user_email", profileData.email); 
      }

      // 4. Add the user to room_participants and store name, email, and join time
      await addDoc(collection(db, "room_participants"), {
        room_id: roomData.id,
        user_id: profileData.id,
        full_name: profileData.full_name,  // ✅ Store Full Name
        email: profileData.email,          // ✅ Store Email
        joined_at: serverTimestamp()       // ✅ Store Timestamp
      });

      console.log("Participant added successfully");

      toast({
        title: "Room joined successfully!",
        description: "You can now enter the room.",
      });

      // Navigate to the room
      navigate(`/room/${roomData.id}`);

    } catch (error: any) {
      console.error("Join room error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to join room",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Join Interview Room</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please enter your details to join the room
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Joining..." : "Join Room"}
          </Button>
        </form>
      </div>
    </div>
  );
}
