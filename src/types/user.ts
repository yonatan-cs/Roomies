export type UserProfile = {
  id: string;
  email?: string;
  full_name?: string;
  name?: string;
  displayName?: string;
  phone?: string;
  current_apartment_id?: string;
};

export type UserLike = {
  id?: string;
  full_name?: string;
  name?: string;
  displayName?: string;
  email?: string;
};
