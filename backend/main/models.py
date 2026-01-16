"""Pydantic models for API validation"""
from pydantic import BaseModel, Field
from typing import Optional

class PaymentRequest(BaseModel):
    category_id: int = Field(..., gt=0)
    amount: float = Field(..., gt=0)
    description: str = Field(default='')
    payment_date: str = Field(default='')
    legal_entity_id: int = Field(default=None)
    contractor_id: int = Field(default=None)
    department_id: int = Field(default=None)
    service_id: int = Field(default=None)
    invoice_number: str = Field(default=None)
    invoice_date: str = Field(default=None)

class CategoryRequest(BaseModel):
    name: str = Field(..., min_length=1)
    icon: str = Field(default='Tag')

class LegalEntityRequest(BaseModel):
    name: str = Field(..., min_length=1)
    inn: str = Field(default='')
    kpp: str = Field(default='')
    address: str = Field(default='')

class CustomFieldRequest(BaseModel):
    name: str = Field(..., min_length=1)
    field_type: str = Field(..., pattern='^(text|select|file|toggle)$')
    options: str = Field(default='')

class ContractorRequest(BaseModel):
    name: str = Field(..., min_length=1)
    inn: str = Field(default='')
    kpp: str = Field(default='')
    ogrn: str = Field(default='')
    legal_address: str = Field(default='')
    actual_address: str = Field(default='')
    phone: str = Field(default='')
    email: str = Field(default='')
    contact_person: str = Field(default='')
    bank_name: str = Field(default='')
    bank_bik: str = Field(default='')
    bank_account: str = Field(default='')
    correspondent_account: str = Field(default='')
    notes: str = Field(default='')

class CustomerDepartmentRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')

class RoleRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')
    permission_ids: list[int] = Field(default=[])

class PermissionRequest(BaseModel):
    name: str = Field(..., min_length=1)
    resource: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    description: str = Field(default='')

class ApprovalActionRequest(BaseModel):
    payment_id: int = Field(..., gt=0)
    action: str = Field(..., pattern='^(approve|reject)$')
    comment: str = Field(default='')

class ServiceRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default='')
    intermediate_approver_id: int = Field(..., gt=0)
    final_approver_id: int = Field(..., gt=0)
    customer_department_id: Optional[int] = None

class SavingRequest(BaseModel):
    service_id: int = Field(..., gt=0)
    description: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    frequency: str = Field(..., pattern='^(once|monthly|quarterly|yearly)$')
    currency: str = Field(default='RUB')
    employee_id: int = Field(..., gt=0)
    saving_reason_id: Optional[int] = None

class SavingReasonRequest(BaseModel):
    name: str = Field(..., min_length=1)
    icon: str = Field(default='Target')
