import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  // The user requested to remove the text and spacing entirely from this area
  return null;
}
