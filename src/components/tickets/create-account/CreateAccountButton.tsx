import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CreateAccountModal, { AccountTarget } from './CreateAccountModal';

interface CreateAccountButtonProps {
  ticketId?: number;
}

const CreateAccountButton = ({ ticketId }: CreateAccountButtonProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [targets, setTargets] = useState<AccountTarget[]>(['bitrix', 'email']);

  const openWith = (t: AccountTarget[]) => {
    setTargets(t);
    setModalOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-md shadow-blue-500/30"
          >
            <Icon name="UserPlus" size={16} className="mr-1.5" />
            <span className="hidden sm:inline">Создать учётную запись</span>
            <span className="sm:hidden">Учётка</span>
            <Icon name="ChevronDown" size={14} className="ml-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openWith(['bitrix', 'email'])}>
            <Icon name="LayoutGrid" size={16} className="mr-2" />
            Битрикс + корпоративная почта
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateAccountModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        targets={targets}
        ticketId={ticketId}
      />
    </>
  );
};

export default CreateAccountButton;