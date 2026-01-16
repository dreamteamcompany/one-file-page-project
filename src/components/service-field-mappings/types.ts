export interface ServiceCategory {
  id: number;
  name: string;
  icon?: string;
}

export interface Service {
  id: number;
  name: string;
  description?: string;
  category_id: number;
}

export interface FieldGroup {
  id: number;
  name: string;
  description?: string;
  field_ids: number[];
}

export interface ServiceFieldMapping {
  id: number;
  service_category_id: number;
  service_id: number;
  field_group_ids: number[];
  created_at?: string;
  updated_at?: string;
}
