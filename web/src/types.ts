export interface Sighting {
  id: string;
  createdAt: string;
  originalUrl: string;
  lofiUrl: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}
