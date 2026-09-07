import { redirect } from "next/navigation";
export default function GroupAnnouncementsPage({ params }: { params: { conversationId: string } }) { redirect(`/messages/group/${params.conversationId}/announcement`); }
