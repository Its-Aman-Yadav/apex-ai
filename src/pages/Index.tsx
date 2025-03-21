"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PlusCircle, LogOut, AlertCircle, Loader2, LayoutDashboard } from "lucide-react"
import { auth, db } from "../../config/firebase"
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, deleteDoc } from "firebase/firestore"
import { signOut, onAuthStateChanged } from "firebase/auth"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import AuthWrapper from "@/components/auth-wrapper"
import CreateRoomForm from "@/components/rooms/CreateRoomForm"
import RoomCard from "@/components/rooms/RoomCard"
import type { Room } from "@/types/room"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const Index = () => {
  const [rooms, setRooms] = useState<Room[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        fetchUserDetails(currentUser.uid)
      } else {
        setLoading(false)
        navigate("/auth")
      }
    })

    return () => unsubscribe()
  }, [navigate])

  const fetchUserDetails = async (userId: string) => {
    try {
      // First try to get user data from Firestore
      const userRef = doc(db, "users", userId)
      const userDoc = await getDoc(userRef)

      if (userDoc.exists()) {
        setUser({ id: userDoc.id, ...userDoc.data() })
        setConnectionError(null)
        // Fetch rooms after user is confirmed
        fetchRooms(userId)
      } else {
        // If user document doesn't exist in Firestore, create one with auth data
        const newUserData = {
          id: userId,
          displayName: auth.currentUser?.displayName || "User",
          name: auth.currentUser?.displayName || "User",
          email: auth.currentUser?.email,
          createdAt: new Date(),
        }

        // Try to create the user document
        try {
          await setDoc(doc(db, "users", userId), newUserData)
          setUser(newUserData)
          setConnectionError(null)
          // Fetch rooms after user is created
          fetchRooms(userId)
        } catch (error) {
          console.error("Error creating user document:", error)
          // Fallback to using auth data if document creation fails
          setUser({
            id: userId,
            displayName: auth.currentUser?.displayName || "User",
            name: auth.currentUser?.displayName || "User",
            email: auth.currentUser?.email,
          })
          setConnectionError("Unable to save user data. Using basic information instead.")
          // Still try to fetch rooms
          fetchRooms(userId)
        }
      }
    } catch (error: any) {
      console.error("Error fetching user details:", error)

      // Set a more user-friendly error message
      setConnectionError("Unable to connect to the database. This might be due to a network issue or content blockers.")

      // Use auth data as fallback
      if (auth.currentUser) {
        setUser({
          id: userId,
          displayName: auth.currentUser.displayName || "User",
          name: auth.currentUser.displayName || "User",
          email: auth.currentUser.email,
        })
      }

      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Unable to retrieve your profile data. Using basic information instead.",
      })
      setLoading(false)
    }
  }

  const fetchRooms = async (userId: string) => {
    try {
      // First fetch rooms created by the user
      const roomsRef = collection(db, "rooms")
      const ownedRoomsQuery = query(roomsRef, where("created_by", "==", userId), orderBy("created_at", "desc"))

      const ownedRoomsSnapshot = await getDocs(ownedRoomsQuery)
      const ownedRooms = ownedRoomsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      // Then fetch rooms where the user is a participant
      const participatedRoomsQuery = query(
        roomsRef,
        where("participants", "array-contains", userId), // ✅ Alternative way
        orderBy("created_at", "desc"),
      )

      const participatedRoomsSnapshot = await getDocs(participatedRoomsQuery)
      const participatedRooms = participatedRoomsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      // Combine and transform the results
      const allRooms = [...ownedRooms, ...participatedRooms]
      const transformedRooms = allRooms.map((room) => ({
        ...room,
        questions: (room.questions || []).map((q) => ({
          id: q.id,
          text: q.text,
        })),
        criteria: (room.criteria || []).map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          maxScore: c.maxScore,
        })),
      })) as Room[]

      setRooms(transformedRooms)
      setConnectionError(null)
    } catch (error: any) {
      console.error("Error fetching rooms:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch rooms",
      })
      setConnectionError("Unable to retrieve room data. This might be due to a network issue or content blockers.")
    } finally {
      setLoading(false)
    }
  }

  const handleRoomCreated = (newRoom: Room) => {
    setRooms([newRoom, ...rooms])
  }

  const handleRoomDeleted = async (roomId: string) => {
    try {
      await deleteDoc(doc(db, "rooms", roomId))

      setRooms(rooms.filter((room) => room.id !== roomId))
      toast({
        title: "Success",
        description: "Room deleted successfully",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete room",
      })
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      navigate("/auth")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to sign out",
      })
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading your interview rooms...</p>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10 shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-primary">AI Interview Room</h1>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden md:inline-block">{auth.currentUser?.email}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="rounded-full h-10 w-10 p-0">
                      <Avatar>
                        <AvatarImage src={auth.currentUser?.photoURL || undefined} alt={user?.displayName || "User"} />
                        <AvatarFallback>{getInitials(user?.displayName || "User")}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{auth.currentUser?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {connectionError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}

          <section className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-primary">Create Your Interview Room</h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Set up customized interview spaces with AI-powered assessments to streamline your hiring process
            </p>

            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 rounded-full px-6 shadow-md hover:shadow-lg transition-all">
                  <PlusCircle className="w-5 h-5" />
                  Create New Room
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Interview Room</DialogTitle>
                  <DialogDescription>Set up a new room for conducting AI-powered interviews</DialogDescription>
                </DialogHeader>
                <CreateRoomForm userId={user?.id} onRoomCreated={handleRoomCreated} />
              </DialogContent>
            </Dialog>
          </section>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 border-l-4 border-primary pl-3">Your Interview Rooms</h3>
            {rooms.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                  <RoomCard key={room.id} room={room} onDelete={handleRoomDeleted} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 px-4 border border-dashed rounded-lg bg-muted/30">
                <div className="flex justify-center mb-4">
                  <PlusCircle className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium mb-2">No interview rooms yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  You haven't created any interview rooms yet. Create your first room to get started with AI-powered
                  interviews.
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Create Your First Room
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Interview Room</DialogTitle>
                      <DialogDescription>Set up a new room for conducting AI-powered interviews</DialogDescription>
                    </DialogHeader>
                    <CreateRoomForm userId={user?.id} onRoomCreated={handleRoomCreated} />
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  return <AuthWrapper>{renderContent()}</AuthWrapper>
}

export default Index

