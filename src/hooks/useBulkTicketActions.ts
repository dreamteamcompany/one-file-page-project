import { useState, useCallback } from 'react';

export const useBulkTicketActions = () => {
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set());

  const toggleTicketSelection = useCallback((ticketId: number) => {
    setSelectedTicketIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  }, []);

  const toggleAllTickets = useCallback((ticketIds: number[], allSelected: boolean) => {
    if (allSelected) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(ticketIds));
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTicketIds(new Set());
  }, []);

  const isTicketSelected = useCallback((ticketId: number) => {
    return selectedTicketIds.has(ticketId);
  }, [selectedTicketIds]);

  return {
    selectedTicketIds: Array.from(selectedTicketIds),
    selectedCount: selectedTicketIds.size,
    toggleTicketSelection,
    toggleAllTickets,
    clearSelection,
    isTicketSelected,
  };
};
