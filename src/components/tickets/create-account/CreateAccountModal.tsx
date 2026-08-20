import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import CreateAccountForm from './CreateAccountForm';
import CreateAccountResults from './CreateAccountResults';
import { useCreateAccountForm } from './useCreateAccountForm';
import { CreateAccountModalProps } from './types';

export type { AccountTarget, AccountInitialValues } from './types';

const CreateAccountModal = ({ open, onOpenChange, targets, ticketId, initialValues }: CreateAccountModalProps) => {
  const form = useCreateAccountForm({ open, onOpenChange, targets, ticketId, initialValues });

  return (
    <Dialog open={open} onOpenChange={form.handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать учётную запись</DialogTitle>
          <DialogDescription>{form.targetsLabel}</DialogDescription>
        </DialogHeader>

        {!form.results ? (
          <CreateAccountForm
            portal={form.portal}
            setPortal={form.setPortal}
            domainsLoading={form.domainsLoading}
            domainsError={form.domainsError}
            domains={form.domains}
            domain={form.domain}
            setDomain={form.setDomain}
            lastName={form.lastName}
            setLastName={form.setLastName}
            firstName={form.firstName}
            setFirstName={form.setFirstName}
            middleName={form.middleName}
            setMiddleName={form.setMiddleName}
            birthDate={form.birthDate}
            setBirthDate={form.setBirthDate}
            hireDate={form.hireDate}
            setHireDate={form.setHireDate}
            position={form.position}
            setPosition={form.setPosition}
            positionOptions={form.positionOptions}
            departmentOptions={form.departmentOptions}
            departmentList={form.departmentList}
            addDepartment={form.addDepartment}
            removeDepartment={form.removeDepartment}
            heads={form.heads}
            removeHead={form.removeHead}
            city={form.city}
            setCity={form.setCity}
            phone={form.phone}
            setPhone={form.setPhone}
            gender={form.gender}
            setGender={form.setGender}
            photoPreview={form.photoPreview}
            handlePhoto={form.handlePhoto}
            loading={form.loading}
            handleClose={form.handleClose}
            handleSubmit={form.handleSubmit}
          />
        ) : (
          <CreateAccountResults
            results={form.results}
            resultDepartments={form.resultDepartments}
            copiedKey={form.copiedKey}
            copy={form.copy}
            handleClose={form.handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateAccountModal;
