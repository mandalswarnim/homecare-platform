import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type Service = {
  name: string;
  /** Which clinicians can deliver it */
  who: 'doctor' | 'nurse' | 'any';
  minutes: number;
  icon: IconName;
  blurb: string;
};

export const SERVICES: Service[] = [
  { name: 'Doctor home visit', who: 'doctor', minutes: 60, icon: 'medkit-outline', blurb: 'Examination and treatment at home' },
  { name: 'Nursing care', who: 'nurse', minutes: 60, icon: 'heart-outline', blurb: 'Daily care, hygiene and medication' },
  { name: 'Wound dressing', who: 'nurse', minutes: 45, icon: 'bandage-outline', blurb: 'Clean and dress wounds' },
  { name: 'Injection / IV therapy', who: 'nurse', minutes: 45, icon: 'eyedrop-outline', blurb: 'Injections, drips and insulin' },
  { name: 'Vitals check', who: 'any', minutes: 30, icon: 'pulse-outline', blurb: 'Blood pressure, sugar and temperature' },
  { name: 'Medication review', who: 'doctor', minutes: 45, icon: 'document-text-outline', blurb: 'Review prescriptions and doses' },
];

export const serviceIcon = (name: string): IconName =>
  SERVICES.find((s) => s.name === name)?.icon ?? 'medical-outline';
