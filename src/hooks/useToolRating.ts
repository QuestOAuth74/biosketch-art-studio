import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useToolRating(toolId: string) {
  const [totalRatings, setTotalRatings] = useState(0);
  const [ratingSum, setRatingSum] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  const [loading, setLoading] = useState(true);

  const avgRating = totalRatings > 0 ? ratingSum / totalRatings : 0;

  useEffect(() => {
    // Check localStorage for prior rating
    const stored = localStorage.getItem(`tool_rating_${toolId}`);
    if (stored) {
      setUserRating(Number(stored));
      setHasRated(true);
    }

    // Fetch from database
    supabase
      .from("tool_ratings")
      .select("total_ratings, rating_sum")
      .eq("tool_id", toolId)
      .single()
      .then(({ data }) => {
        if (data) {
          setTotalRatings(data.total_ratings);
          setRatingSum(data.rating_sum);
        }
        setLoading(false);
      });
  }, [toolId]);

  const submitRating = async (rating: number) => {
    const previousRating = Number(localStorage.getItem(`tool_rating_prev_${toolId}`) || "0");

    setUserRating(rating);
    setHasRated(true);
    localStorage.setItem(`tool_rating_${toolId}`, String(rating));
    localStorage.setItem(`tool_rating_prev_${toolId}`, String(rating));

    // Optimistic update
    if (previousRating > 0) {
      setRatingSum(prev => prev - previousRating + rating);
    } else {
      setTotalRatings(prev => prev + 1);
      setRatingSum(prev => prev + rating);
    }

    const { data } = await supabase.rpc("submit_tool_rating", {
      p_tool_id: toolId,
      p_rating: rating,
      p_previous_rating: previousRating,
    });

    if (data) {
      const d = data as any;
      setTotalRatings(d.total_ratings);
      setRatingSum(d.rating_sum);
    }
  };

  return { avgRating, totalRatings, userRating, hasRated, loading, submitRating };
}
