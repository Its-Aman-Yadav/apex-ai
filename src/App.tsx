import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import JoinRoom from "@/components/rooms/JoinRoom";
import InterviewRoom from "@/components/rooms/InterviewRoom";
import EditRoom from "@/components/rooms/EditRoom";
import ThankYouPage from "@/components/rooms/ThankYouPage";
import RoomCandidates from "@/components/rooms/RoomCandidates";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>Apex AI - AI-Powered Mock Interviews</title>
      </Helmet>

      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/join/:shareId" element={<JoinRoom />} />
          <Route path="/room/:roomId" element={<InterviewRoom />} />
          <Route path="/room/:roomId/edit" element={<EditRoom />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/room/:roomId/candidates" element={<RoomCandidates />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </HelmetProvider>
  );
}
