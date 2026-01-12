import Icon from '@/components/ui/icon';

interface TicketsHeaderProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

const TicketsHeader = ({ menuOpen, setMenuOpen }: TicketsHeaderProps) => {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 px-4 py-4 bg-[#1b254b]/50 backdrop-blur-[20px] rounded-[15px] border border-white/10">
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden p-2 text-white"
        >
          <Icon name="Menu" size={24} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Icon name="Ticket" size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Заявки</h1>
            <p className="text-sm text-muted-foreground">Управление заявками в техподдержку</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3 px-3 md:px-[15px] py-2 md:py-[10px] rounded-[12px] bg-white/5 border border-white/10">
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-[10px] bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm md:text-base">
          А
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-medium">Администратор</div>
          <div className="text-xs text-muted-foreground">Администратор</div>
        </div>
      </div>
    </header>
  );
};

export default TicketsHeader;
