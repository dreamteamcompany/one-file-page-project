import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/utils/api';

interface Category {
  id: number;
  name: string;
  description?: string;
  icon: string;
}

interface Priority {
  id: number;
  name: string;
  level: number;
  color: string;
}

interface Status {
  id: number;
  name: string;
  color: string;
  is_closed: boolean;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface CustomField {
  id: number;
  name: string;
  field_type: string;
  options?: string;
  is_required: boolean;
  value?: string;
}

interface Service {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
  service_ids?: number[];
}

interface Ticket {
  id: number;
  title: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  category_icon?: string;
  priority_id?: number;
  priority_name?: string;
  priority_color?: string;
  status_id?: number;
  status_name?: string;
  status_color?: string;
  department_id?: number;
  department_name?: string;
  created_by: number;
  customer_name?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  custom_fields?: CustomField[];
  has_response?: boolean;
}

export const useTicketsData = () => {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [ticketServices, setTicketServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}?endpoint=tickets`, {
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
  };

  const loadServices = async () => {
    if (!token) return;

    try {
      // Загружаем "Услуги заявок" (ticket_services) для выбора на шаге 2
      const ticketServicesResponse = await fetch(`${API_URL}?endpoint=ticket-services`, {
        headers: {
          'X-Auth-Token': token,
        },
      });

      if (ticketServicesResponse.ok) {
        const data = await ticketServicesResponse.json();
        setTicketServices(data || []);
      }

      // Загружаем "Сервисы услуг" (services) для выбора на шаге 3
      const servicesResponse = await fetch(`${API_URL}?endpoint=services`, {
        headers: {
          'X-Auth-Token': token,
        },
      });

      if (servicesResponse.ok) {
        const data = await servicesResponse.json();
        setServices(data.services || []);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  const loadDictionaries = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}?endpoint=ticket-dictionaries-api`, {
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
  };

  useEffect(() => {
    if (token) {
      setLoading(true);
      loadTickets().finally(() => setLoading(false));
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