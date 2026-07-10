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
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-blue-500/30"
          >
            <Icon name="UserPlus" size={18} className="mr-2" />
            Создать учётную запись
            <Icon name="ChevronDown" size={16} className="ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-[--radix-dropdown-menu-trigger-width]">
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
