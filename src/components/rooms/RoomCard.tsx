
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Edit, Trash } from "lucide-react";
import type { Room } from "@/types/room";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Users, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface RoomCardProps {
  room: Room;
  onDelete: (roomId: string) => void;
}

export default function RoomCard({ room, onDelete }: RoomCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleShare = () => {
    // Force the production URL in production, otherwise use the current origin
    const productionUrl = "https://apex-ai-jade.vercel.app/";
    const shareUrl = `${
      process.env.NODE_ENV === "production" 
        ? productionUrl 
        : window.location.origin
    }/join/${room.share_id}`;
    
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied",
      description: "Interview room link has been copied to clipboard",
    });
  };
  

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">{room.name}</h2>
          <p className="text-sm text-muted-foreground">{room.description}</p>
        </div>
        <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-40">
    <DropdownMenuItem onClick={() => navigate(`/room/${room.id}`)}>
      <Play className="mr-2 h-4 w-4" />
      Demo
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => navigate(`/room/${room.id}/edit`)}>
      <Edit className="mr-2 h-4 w-4" />
      Edit Room
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onDelete(room.id)} className="text-destructive">
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

      </div>
      <div className="flex gap-2">
      <Button 
  variant="outline" 
  size="sm" 
  className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
  onClick={() => navigate(`/room/${room.id}/candidates`)}
>
  <Users className="w-4 h-4 mr-2" />
  Show Candidates
</Button>

        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={handleShare}
        >
          <Send className="w-4 h-4 mr-2" />
          Send Invite
        </Button>
      </div>
    </Card>
  );
}
