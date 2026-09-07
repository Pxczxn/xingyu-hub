import { redirect } from "next/navigation";
export default function GroupInvitePage({ params }: { params: { conversationId: string } }) { redirect(`/messages/group/${params.conversationId}`); }
