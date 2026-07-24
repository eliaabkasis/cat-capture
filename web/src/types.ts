export interface Sighting {
  id: string;
  createdAt: string;
  originalUrl: string;
  lofiUrl: string;
  thumbUrl: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}

export type FriendUser = User;

export interface FriendRequest {
  id: string;
  createdAt: string;
  user: FriendUser;
}
