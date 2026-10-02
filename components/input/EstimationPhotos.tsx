/** AI が栄養値を読み取った元の写真。数値が正しいか見比べられるよう大きく見せる。 */
export function EstimationPhotos({ photos }: { photos?: string[] }) {
  if (!photos?.length) return null;
  return (
    <ul className="space-y-2">
      {photos.map((src, index) => (
        <li key={src}>
          {/* oxlint-disable-next-line nextjs/no-img-element -- 端末内で縮小済みの写真の表示で最適化は不要 */}
          <img
            src={src}
            alt={`読み取り元の写真 ${index + 1}`}
            className="bg-muted max-h-80 w-full rounded-lg object-contain"
          />
        </li>
      ))}
    </ul>
  );
}
