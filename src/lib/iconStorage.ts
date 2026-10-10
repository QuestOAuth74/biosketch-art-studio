import { IconItem, IconCategory } from "@/types/icon";

const ICONS_KEY = "science_canvas_icons";
const CATEGORIES_KEY = "science_canvas_categories";

// Default categories for scientific illustrations
const DEFAULT_CATEGORIES: IconCategory[] = [
  { id: "bioicons-chemistry", name: "Bioicons - Chemistry" },
  { id: "bioicons-biology", name: "Bioicons - Biology" },
  { id: "bioicons-physics", name: "Bioicons - Physics" },
  { id: "bioicons-medical", name: "Bioicons - Medical" },
  { id: "cells", name: "Cells & Organelles" },
  { id: "molecules", name: "Molecules & Proteins" },
  { id: "lab", name: "Lab Equipment" },
  { id: "anatomy", name: "Anatomy" },
  { id: "plants", name: "Plants" },
  { id: "animals", name: "Animals" },
  { id: "symbols", name: "Symbols & Arrows" },
  { id: "other", name: "Other" },
];

export const iconStorage = {
  // Icons
  getIcons: (): IconItem[] => {
    const stored = localStorage.getItem(ICONS_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveIcon: (icon: IconItem): void => {
    const icons = iconStorage.getIcons();
    icons.push(icon);
    localStorage.setItem(ICONS_KEY, JSON.stringify(icons));
  },

  deleteIcon: (id: string): void => {
    const icons = iconStorage.getIcons().filter((icon) => icon.id !== id);
    localStorage.setItem(ICONS_KEY, JSON.stringify(icons));
  },

  getIconsByCategory: (category: string): IconItem[] => {
    return iconStorage.getIcons().filter((icon) => icon.category === category);
  },

  // Categories
  getCategories: (): IconCategory[] => {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (!stored) {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(stored);
  },

  saveCategory: (category: IconCategory): void => {
    const categories = iconStorage.getCategories();
    categories.push(category);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  },

  deleteCategory: (id: string): void => {
    const categories = iconStorage.getCategories().filter((cat) => cat.id !== id);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  },
};
