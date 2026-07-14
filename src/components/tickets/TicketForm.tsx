import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import TicketFormStep1 from './TicketFormStep1';
import TicketFormStepClassify from './TicketFormStepClassify';
import TicketFormStepService from './TicketFormStepService';
import TicketFormStepServiceItems from './TicketFormStepServiceItems';
import TicketFormStep4 from './TicketFormStep4';
import TicketFormStepper from './TicketFormStepper';
import { useTicketFormLogic } from './useTicketFormLogic';
import { TicketFormProps } from './TicketFormTypes';

const TicketForm = ({
  dialogOpen,
  setDialogOpen,
  formData,
  setFormData,
  categories: _categories,
  priorities,
  statuses: _statuses,
  departments: _departments,
  customFields: _customFields,
  services,
  ticketServices = [],
  handleSubmit,
  onDialogOpen,
  canCreate = true,
}: TicketFormProps) => {
  const {
    step,
    displayStep,
    classifying,
    classification,
    clarifyingAnswers,
    setClarifyingAnswers,
    visibleCustomFields,
    classificationMode,
    fileUploader,
    selectedServices,
    selectedTicketService,
    filteredServices,
    availableTicketServices,
    stepLabels,
    totalSteps,
    handleDialogChange,
    handleNextFromDescription,
    handleChangeTicketService,
    toggleService,
    getCustomFieldsStep,
    handleNextFromClassify,
    handleNextFromManualService,
    handleNextFromManualServiceItems,
    handleNextFromManualCustomFields,
    handleBack,
    onSubmit,
    isSubmitting,
  } = useTicketFormLogic({
    formData,
    setFormData,
    services,
    ticketServices,
    handleSubmit,
    onDialogOpen,
    setDialogOpen,
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
      {canCreate && (
        <DialogTrigger asChild>
          <Button size="lg" className="gap-2 shadow-lg">
            <Icon name="Plus" size={20} />
            Создать заявку
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="max-w-6xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="TicketPlus" size={24} />
            Новая заявка
          </DialogTitle>
          <DialogDescription className="text-sm">
            {stepLabels[displayStep - 1] && `Шаг ${displayStep} из ${totalSteps}: ${stepLabels[displayStep - 1]}`}
          </DialogDescription>
        </DialogHeader>

        <TicketFormStepper
          step={displayStep}
          stepLabels={stepLabels}
          classifying={classifying}
        />

        {!classifying && step === 1 && classificationMode === 'ai' && (
          <TicketFormStep1
            formData={formData}
            setFormData={setFormData}
            priorities={priorities}
            selectedTicketService={undefined}
            hasCustomFields={false}
            onNext={handleNextFromDescription}
            onSubmit={async (e) => { e.preventDefault(); handleNextFromDescription(); }}
            onBack={() => handleDialogChange(false)}
            isFirstStep
            classificationMode={classificationMode}
            attachments={fileUploader.attachments}
            isUploadingFiles={fileUploader.isUploading}
            onSelectFiles={fileUploader.uploadMany}
            onRemoveAttachment={fileUploader.remove}
            isSubmitting={isSubmitting}
          />
        )}

        {!classifying && step === 1 && classificationMode === 'manual' && (
          <TicketFormStepService
            ticketServices={availableTicketServices}
            selectedTicketServiceId={formData.service_id}
            onChangeTicketService={handleChangeTicketService}
            onNext={handleNextFromManualService}
            onBack={() => handleDialogChange(false)}
            isFirstStep
          />
        )}

        {!classifying && step === 2 && classificationMode === 'ai' && (
          <TicketFormStepClassify
            classification={classification || { ticket_service_id: 0, service_ids: [], ticket_service_name: '', service_names: [], confidence: 0 }}
            ticketServices={availableTicketServices}
            services={services}
            selectedTicketServiceId={formData.service_id}
            selectedServices={selectedServices}
            onChangeTicketService={handleChangeTicketService}
            onToggleService={toggleService}
            onNext={handleNextFromClassify}
            onBack={handleBack}
            filteredServices={filteredServices}
            classificationMode={classificationMode}
            clarifyingAnswers={clarifyingAnswers}
            onChangeClarifyingAnswer={(idx, value) =>
              setClarifyingAnswers((prev) => ({ ...prev, [idx]: value }))
            }
          />
        )}

        {!classifying && step === 2 && classificationMode === 'manual' && (
          <TicketFormStepServiceItems
            filteredServices={filteredServices}
            allServices={services}
            selectedServices={selectedServices}
            onToggleService={toggleService}
            onNext={handleNextFromManualServiceItems}
            onBack={handleBack}
          />
        )}

        {!classifying && step === 3 && classificationMode === 'manual' && visibleCustomFields.length > 0 && (
          <TicketFormStep4
            formData={formData}
            setFormData={setFormData}
            customFields={visibleCustomFields}
            onNext={handleNextFromManualCustomFields}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        )}

        {!classifying && step === 4 && classificationMode === 'manual' && (
          <TicketFormStep1
            formData={formData}
            setFormData={setFormData}
            priorities={priorities}
            selectedTicketService={selectedTicketService}
            hasCustomFields={false}
            onSubmit={onSubmit}
            onBack={handleBack}
            classificationMode={classificationMode}
            attachments={fileUploader.attachments}
            isUploadingFiles={fileUploader.isUploading}
            onSelectFiles={fileUploader.uploadMany}
            onRemoveAttachment={fileUploader.remove}
            isSubmitting={isSubmitting}
          />
        )}

        {!classifying && step === getCustomFieldsStep() && classificationMode === 'ai' && visibleCustomFields.length > 0 && (
          <TicketFormStep4
            formData={formData}
            setFormData={setFormData}
            customFields={visibleCustomFields}
            onSubmit={onSubmit}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TicketForm;