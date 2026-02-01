import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useGreetings() {
  return useQuery({
    queryKey: [api.greetings.get.path],
    queryFn: async () => {
      const res = await fetch(api.greetings.get.path);
      if (!res.ok) throw new Error("Failed to fetch greetings");
      // Validate the response with the shared schema
      return api.greetings.get.responses[200].parse(await res.json());
    },
  });
}
