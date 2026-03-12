import {
  ShoppingCart, UtensilsCrossed, Car, Home, Heart, ShoppingBag, Smartphone, Baby, Film, Package,
  Pill, Zap, Dumbbell, Plane, GraduationCap, Scissors, PawPrint, Gift, Wrench, Wallet,
  Coffee, Music, Gamepad2, BookOpen, Star, Globe, Camera, Bike, Train, Briefcase,
  Building2, TreePine, Tv, Watch, Laptop, Pizza, Apple, Beer, Cookie, Sun,
  type LucideIcon,
} from 'lucide-react'

export const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, UtensilsCrossed, Car, Home, Heart, ShoppingBag, Smartphone, Baby, Film, Package,
  Pill, Zap, Dumbbell, Plane, GraduationCap, Scissors, PawPrint, Gift, Wrench, Wallet,
  Coffee, Music, Gamepad2, BookOpen, Star, Globe, Camera, Bike, Train, Briefcase,
  Building2, TreePine, Tv, Watch, Laptop, Pizza, Apple, Beer, Cookie, Sun,
}

export const ICON_PRESETS = Object.keys(ICON_MAP)

export function CategoryIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = ICON_MAP[icon]
  if (Icon) return <Icon size={size} strokeWidth={1.75} />
  // Fallback: emoji strings stored in localStorage before migration
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{icon}</span>
}
