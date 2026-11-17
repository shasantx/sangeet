import { getTracks } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { TrackRow } from "./track-row";

interface TrackListProps {
  trackIds: string[];
  label: string;
  showIndex?: boolean;
  showAlbum?: boolean;
  showArtwork?: boolean;
  onRemove?: (trackId: string) => void;
  removeLabel?: string;
  className?: string;
}

export function TrackList({
  trackIds,
  label,
  showIndex = true,
  showAlbum = true,
  showArtwork = true,
  onRemove,
  removeLabel,
  className,
}: TrackListProps) {
  const tracks = getTracks(trackIds);

  return (
    <div className={cn("space-y-0.5", className)} role="list" aria-label={label}>
      {tracks.map((track, index) => (
        <div role="listitem" key={`${track.id}-${index}`}>
          <TrackRow
            track={track}
            index={index}
            contextIds={trackIds}
            contextLabel={label}
            showIndex={showIndex}
            showAlbum={showAlbum}
            showArtwork={showArtwork}
            onRemove={onRemove ? () => onRemove(track.id) : undefined}
            removeLabel={removeLabel}
          />
        </div>
      ))}
    </div>
  );
}
