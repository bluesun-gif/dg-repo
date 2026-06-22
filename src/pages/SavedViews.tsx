import { Bookmark, Plus } from 'lucide-react';

export default function SavedViews() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center">
          <Bookmark size={18} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Saved Views</h1>
          <p className="text-sm text-muted-foreground">Save your document filter combinations for quick access</p>
        </div>
      </div>
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Bookmark size={28} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No saved views</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Apply filters on the Documents page, then save the combination here for quick access later.
        </p>
        <button className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors mx-auto">
          <Plus size={13} /> Create Saved View
        </button>
      </div>
    </div>
  );
}
