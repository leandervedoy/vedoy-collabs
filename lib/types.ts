export type Creator = {
  user_id: string; display_name: string; headline: string; bio: string; location: string;
  roles: string[]; skills: string[]; interests: string[]; availability: string;
  experience_level?: string | null; avatar_url?: string | null; banner_url?: string | null;
  portfolio: Array<{title?: string; url?: string; description?: string}>; social_links: Record<string,string>;
  verified: boolean; follower_count: number;
};
export type ContactRequest = {
  id: string; requester_id: string; target_id: string; note: string;
  status: "pending"|"accepted"|"declined"; created_at: string;
};
export type Conversation = { id: string; user_a: string; user_b: string; created_at: string };
export type Message = { id: string; match_id: string; sender_id: string; body: string; created_at: string };
export type Project = { id: string; owner_id: string; title: string; description: string; category: string; budget: string; deadline: string|null; status: string };
