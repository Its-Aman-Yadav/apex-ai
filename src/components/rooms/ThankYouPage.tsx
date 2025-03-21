import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ThankYouPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-green-600">Thank You!</h1>
        <p className="text-lg text-gray-600">
          Your interview has been completed successfully. Our system is evaluating your responses.
        </p>
      </div>
    </div>
  );
}
