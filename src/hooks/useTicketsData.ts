import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL, apiFetch } from '@/utils/api';
import type {
  Ticket,
  CustomField,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketDepartment,
  TicketService,
} from '@/types';

export const useTicketsData = () => {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [priorities, setPriorities] = useState<TicketPriority[]>([]);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [departments, setDepartments] = useState<TicketDepartment[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [services, setServices] = useState<TicketService[]>([]);
  const [ticketServices, setTicketServices] = useState<TicketService[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    if (!token) return;

    try {
      const response = await apiFetch(`${API_URL}?endpoint=tickets`, {
        headers: {
          'X-Auth-Token': token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      } else {
        console.error('Tickets response not OK:', response.status, await response.text());
        setTickets([]);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setTickets([]);
    }
  }, [token]);

  const loadServices = useCallback(async () => {
    if (!token) return;

    try {
      // Загружаем "Категории услуг" для выбора на шаге 2
      const categoriesResponse = await apiFetch(`${API_URL}?endpoint=service_categories`, {
        headers: {
          'X-Auth-Token': token,
        },
      });

      if (categoriesResponse.ok) {
        const data = await categoriesResponse.json();
        setTicketServices(data || []);
      }

      // Загружаем "Сервисы услуг" для выбора на шаге 3
      const servicesResponse = await apiFetch(`${API_URL}?endpoint=services`, {
        headers: {
          'X-Auth-Token': token,
        },
      });

      if (servicesResponse.ok) {
        const data = await servicesResponse.json();
        setServices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  }, [token]);

  const loadDictionaries = useCallback(async () => {
    if (!token) return;

    try {
      const response = await apiFetch(`${API_URL}?endpoint=ticket-dictionaries-api`, {
        headers: {
          'X-Auth-Token': token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
        setPriorities(data.priorities || []);
        setStatuses(data.statuses || []);
        setDepartments(data.departments || []);
        setCustomFields(data.custom_fields || []);
      } else {
        console.error('Dictionaries response not OK:', response.status, await response.text());
        // Fallback данные
        setPriorities([
          { id: 1, name: 'Низкий', level: 1, color: '#6b7280' },
          { id: 2, name: 'Средний', level: 2, color: '#3b82f6' },
          { id: 3, name: 'Высокий', level: 3, color: '#f97316' },
          { id: 4, name: 'Критический', level: 4, color: '#ef4444' }
        ]);
        setStatuses([
          { id: 1, name: 'Новая', color: '#3b82f6', is_closed: false },
          { id: 2, name: 'В работе', color: '#eab308', is_closed: false },
          { id: 3, name: 'Ожидание', color: '#f97316', is_closed: false },
          { id: 4, name: 'Решена', color: '#22c55e', is_closed: true },
          { id: 5, name: 'Закрыта', color: '#6b7280', is_closed: true }
        ]);
      }
    } catch (err) {
      console.error('Failed to load dictionaries:', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([
        loadTickets(),
        loadDictionaries(),
        loadServices()
      ]).finally(() => setLoading(false));
    }
  }, [token]);

  return {
    tickets,
    categories,
    priorities,
    statuses,
    departments,
    customFields,
    services,
    ticketServices,
    loading,
    loadTickets,
    loadDictionaries,
    loadServices,
  };
};