import { useQuery } from "@tanstack/react-query";
import { listHistory } from "../lib/api";

export function useHistory() {
  return useQuery({ queryKey: ["history"], queryFn: listHistory, refetchInterval: 2000 });
}
