<?php

// Turns the logo PNGs in brand/source (opaque, white background) into
// transparent, trimmed logos plus app icons, then copy them into the apps.
// Needs PHP with GD (Laragon has it):
//   php packages/tokens/scripts/brand-assets.php packages/tokens/brand/source <out dir>
//
// The source PNGs are small (about 850 px wide), so the 1024 px app icons are
// upscaled. Replace brand/source with an SVG or a 1024 px+ export before the
// store submission and run this again.

[$_, $in, $out] = $argv;
@mkdir($out, 0777, true);

const GREEN = [0x02, 0x7F, 0x45];
const GOLD = [0xE7, 0xA3, 0x3A];

/** GIMP-style "colour to alpha" against white: exact on light backgrounds. */
function whiteToAlpha(GdImage $src): GdImage
{
    $w = imagesx($src);
    $h = imagesy($src);
    $dst = imagecreatetruecolor($w, $h);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    for ($x = 0; $x < $w; $x++) {
        for ($y = 0; $y < $h; $y++) {
            $c = imagecolorat($src, $x, $y);
            $p = [($c >> 16) & 0xFF, ($c >> 8) & 0xFF, $c & 0xFF];
            $a = max(array_map(fn ($v) => (255 - $v) / 255, $p));
            if ($a < 0.02) {
                imagesetpixel($dst, $x, $y, imagecolorallocatealpha($dst, 255, 255, 255, 127));

                continue;
            }
            // Gold and its anti-aliased edge: unmix against the known brand gold, so
            // the pin stays fully opaque gold instead of a see-through orange.
            if ($p[0] - $p[2] > 30 && $p[0] >= $p[1]) {
                $a = min(1, (255 - $p[2]) / (255 - GOLD[2]));
                imagesetpixel($dst, $x, $y, imagecolorallocatealpha($dst, GOLD[0], GOLD[1], GOLD[2], (int) round(127 - $a * 127)));

                continue;
            }
            $rgb = array_map(fn ($v) => (int) max(0, min(255, round(($v - (1 - $a) * 255) / $a))), $p);
            imagesetpixel($dst, $x, $y, imagecolorallocatealpha($dst, $rgb[0], $rgb[1], $rgb[2], (int) round(127 - $a * 127)));
        }
    }

    return $dst;
}

/** Crops fully transparent margins, keeping `$pad` pixels. */
function trimMargins(GdImage $img, int $pad = 4): GdImage
{
    $w = imagesx($img);
    $h = imagesy($img);
    [$minX, $minY, $maxX, $maxY] = [$w, $h, 0, 0];
    for ($x = 0; $x < $w; $x++) {
        for ($y = 0; $y < $h; $y++) {
            if (((imagecolorat($img, $x, $y) >> 24) & 0x7F) < 120) {
                $minX = min($minX, $x);
                $minY = min($minY, $y);
                $maxX = max($maxX, $x);
                $maxY = max($maxY, $y);
            }
        }
    }
    $minX = max(0, $minX - $pad);
    $minY = max(0, $minY - $pad);
    $maxX = min($w - 1, $maxX + $pad);
    $maxY = min($h - 1, $maxY + $pad);

    return crop($img, $minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1);
}

function crop(GdImage $img, int $x, int $y, int $w, int $h): GdImage
{
    $dst = blank($w, $h);
    imagecopy($dst, $img, 0, 0, $x, $y, $w, $h);

    return $dst;
}

function blank(int $w, int $h, ?array $fill = null): GdImage
{
    $img = imagecreatetruecolor($w, $h);
    imagealphablending($img, false);
    imagesavealpha($img, true);
    $color = $fill ? imagecolorallocate($img, ...$fill) : imagecolorallocatealpha($img, 0, 0, 0, 127);
    imagefilledrectangle($img, 0, 0, $w, $h, $color);
    imagealphablending($img, true);

    return $img;
}

/** Green figures become `$rgb` (alpha kept); the gold pin stays gold. */
function recolourGreen(GdImage $img, array $rgb): GdImage
{
    $w = imagesx($img);
    $h = imagesy($img);
    $dst = blank($w, $h);
    imagealphablending($dst, false);
    for ($x = 0; $x < $w; $x++) {
        for ($y = 0; $y < $h; $y++) {
            $c = imagecolorat($img, $x, $y);
            $alpha = ($c >> 24) & 0x7F;
            [$r, $g, $b] = [($c >> 16) & 0xFF, ($c >> 8) & 0xFF, $c & 0xFF];
            $isGreen = $g > $r + 20;
            [$r, $g, $b] = $isGreen ? $rgb : [$r, $g, $b];
            imagesetpixel($dst, $x, $y, imagecolorallocatealpha($dst, $r, $g, $b, $alpha));
        }
    }

    return $dst;
}

/** Everything opaque becomes one colour (Android monochrome icon). */
function silhouette(GdImage $img, array $rgb): GdImage
{
    $w = imagesx($img);
    $h = imagesy($img);
    $dst = blank($w, $h);
    imagealphablending($dst, false);
    for ($x = 0; $x < $w; $x++) {
        for ($y = 0; $y < $h; $y++) {
            $alpha = (imagecolorat($img, $x, $y) >> 24) & 0x7F;
            imagesetpixel($dst, $x, $y, imagecolorallocatealpha($dst, $rgb[0], $rgb[1], $rgb[2], $alpha));
        }
    }

    return $dst;
}

/** Centres `$mark` on a `$size` square canvas at `$scale` of its width. */
function canvas(GdImage $mark, int $size, float $scale, ?array $fill = null): GdImage
{
    $dst = blank($size, $size, $fill);
    imagealphablending($dst, true);
    $tw = (int) round($size * $scale);
    $th = (int) round($tw * imagesy($mark) / imagesx($mark));
    imagecopyresampled($dst, $mark, (int) (($size - $tw) / 2), (int) (($size - $th) / 2), 0, 0, $tw, $th, imagesx($mark), imagesy($mark));

    return $dst;
}

function save(GdImage $img, string $path): void
{
    imagesavealpha($img, true);
    imagepng($img, $path, 9);
    echo basename($path), ' ', imagesx($img), 'x', imagesy($img), PHP_EOL;
}

$full = trimMargins(whiteToAlpha(imagecreatefrompng("$in/whyme_full_logo.png")));
$mark = trimMargins(whiteToAlpha(imagecreatefrompng("$in/whyme_whiteBG_logo.png")));
$markOnGreen = recolourGreen($mark, [255, 255, 255]);

save($full, "$out/whyme-logo-full.png");
save($mark, "$out/whyme-mark.png");
save($markOnGreen, "$out/whyme-mark-white.png");

// App icons: white figures and gold pin on brand green, full bleed (the OS rounds it).
save(canvas($markOnGreen, 1024, 0.62, GREEN), "$out/icon-1024.png");
save(canvas($markOnGreen, 512, 0.62, GREEN), "$out/icon-512.png");
save(canvas($markOnGreen, 192, 0.62, GREEN), "$out/icon-192.png");
save(canvas($markOnGreen, 180, 0.62, GREEN), "$out/apple-icon-180.png");
save(canvas($markOnGreen, 48, 0.70, GREEN), "$out/favicon-48.png");
// Android adaptive icon: the foreground keeps inside the central 66% safe zone.
save(canvas($markOnGreen, 1024, 0.46), "$out/android-icon-foreground.png");
save(blank(1024, 1024, GREEN), "$out/android-icon-background.png");
save(canvas(silhouette($mark, [255, 255, 255]), 1024, 0.46), "$out/android-icon-monochrome.png");
// Splash: the coloured mark on white.
save(canvas($mark, 512, 0.9), "$out/splash-icon.png");
