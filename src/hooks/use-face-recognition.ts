"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { deleteFaceEnrollment, enrollEmployeeFace, listFaceEnrollments, recordFaceAttendance } from "@/queries/face-recognition";

export function useFaceEnrollments() {
  return useQuery({ queryKey: queryKeys.attendanceIntegration.faceEnrollments(), queryFn: listFaceEnrollments });
}

function useInvalidateFaceAttendance() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["attendance-integration"] });
    void client.invalidateQueries({ queryKey: ["reporting"] });
  };
}

export function useEnrollEmployeeFace() { const invalidate = useInvalidateFaceAttendance(); return useMutation({ mutationFn: enrollEmployeeFace, onSuccess: invalidate }); }
export function useDeleteFaceEnrollment() { const invalidate = useInvalidateFaceAttendance(); return useMutation({ mutationFn: deleteFaceEnrollment, onSuccess: invalidate }); }
export function useRecordFaceAttendance() { const invalidate = useInvalidateFaceAttendance(); return useMutation({ mutationFn: recordFaceAttendance, onSuccess: invalidate }); }
