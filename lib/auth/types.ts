export type Department = {
  id: string;
  name: string; // "Digital Creative"
  shortName: string; // "SDC"
  memberCount: number;
  isActive: boolean;
};

export type Member = {
  id: string;
  departmentId: string;
  name: string;
  role: string;
  initials: string;
  avatarColor: string; // hex, e.g. "#1D4ED8"
};
