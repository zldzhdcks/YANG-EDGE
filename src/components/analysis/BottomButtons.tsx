"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function BottomButtons() {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Button variant="secondary" size="lg" fullWidth>
        배당 보기
      </Button>
      <Button variant="secondary" size="lg" fullWidth>
        상세 데이터
      </Button>
      <Button
        variant={isFavorite ? "primary" : "secondary"}
        size="lg"
        fullWidth
        onClick={() => setIsFavorite((prev) => !prev)}
      >
        {isFavorite ? "즐겨찾기됨" : "즐겨찾기"}
      </Button>
    </section>
  );
}
