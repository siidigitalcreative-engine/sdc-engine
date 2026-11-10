import 'server-only';
import type { Department, Member } from './types';

// Swap the two arrays below for your existing department and member queries.
// Everything else in this file can stay as is.

const DEPARTMENTS: Department[] = [
  { id: 'sdc', name: 'Digital Creative', shortName: 'SDC', memberCount: 0, isActive: true },
  { id: 'ecom', name: 'E-commerce', shortName: 'ECOM', memberCount: 0, isActive: true },
  { id: 'sales', name: 'Sales', shortName: 'SALES', memberCount: 0, isActive: true },
  { id: 'admin', name: 'Admin', shortName: 'ADMIN', memberCount: 0, isActive: true },
];

const MEMBERS: Member[] = [
  {
    id: 'che',
    departmentId: 'sdc',
    name: 'Che Navarro',
    role: 'Digital Creative Manager',
    initials: 'CN',
    avatarColor: '#1D4ED8',
  },
  {
    id: 'cha',
    departmentId: 'sdc',
    name: 'Cha',
    role: 'Graphic Artist',
    initials: 'CQ',
    avatarColor: '#E8456B',
  },
  {
    id: 'jansen',
    departmentId: 'sdc',
    name: 'Jansen',
    role: 'Graphic Artist',
    initials: 'JB',
    avatarColor: '#1BA37B',
  },
  {
    id: 'francis',
    departmentId: 'sdc',
    name: 'Francis',
    role: 'Video Editor',
    initials: 'FT',
    avatarColor: '#3B82F6',
  },
  {
    id: 'ayen',
    departmentId: 'sdc',
    name: 'Ayen',
    role: 'Graphic Artist',
    initials: 'AQ',
    avatarColor: '#E11D48',
  },
];

export async function getDepartments(): Promise<Department[]> {
  const counts = MEMBERS.reduce<Record<string, number>>((acc, m) => {
    acc[m.departmentId] = (acc[m.departmentId] ?? 0) + 1;
    return acc;
  }, {});

  return DEPARTMENTS.filter((d) => d.isActive)
    .map((d) => ({ ...d, memberCount: counts[d.id] ?? 0 }))
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));
}

export async function getMembers(): Promise<Member[]> {
  return MEMBERS;
}

export async function getMemberById(id: string): Promise<Member | null> {
  return MEMBERS.find((m) => m.id === id) ?? null;
}

// Replace with a hash comparison once PINs are hashed at rest.
export async function verifyPin(memberId: string, pin: string): Promise<boolean> {
  const member = await getMemberById(memberId);
  if (!member) return false;
  const stored = '1234'; // TODO: read member.pinHash and compare
  return pin === stored;
}
