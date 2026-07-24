import Button from "@/components/ui/Button";

type AutoCombineButtonProps = {
  onClick: () => void;
  isGenerated: boolean;
};

export default function AutoCombineButton({
  onClick,
  isGenerated,
}: AutoCombineButtonProps) {
  return (
    <Button
      fullWidth
      size="lg"
      onClick={onClick}
      className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 font-semibold shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-blue-400"
    >
      {isGenerated ? "EDGE Combo 다시 생성" : "EDGE Combo 생성"}
    </Button>
  );
}
