package ffmpeg

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		want      string
		wantRunes int // when > 0, also assert rune count and UTF-8 validity
	}{
		{
			name:      "ascii_longer_than_80_truncates_to_80",
			input:     strings.Repeat("A", 100),
			want:      strings.Repeat("A", 80),
			wantRunes: 80,
		},
		{
			name:  "ascii_shorter_than_80_unchanged",
			input: "hello world",
			want:  "hello world",
		},
		{
			// 旧实现按字节截断，会把中文截成半个字符
			name:      "chinese_100_chars_truncates_to_80_runes_valid_utf8",
			input:     strings.Repeat("中", 100),
			want:      strings.Repeat("中", 80),
			wantRunes: 80,
		},
		{
			name:  "all_nine_forbidden_characters_replaced",
			input: `a\b/c:d*e?f"g<h>i|j'k`,
			want:  "a_b_c_d_e_f_g_h_i_j_k",
		},
		{
			name:      "mixed_chinese_forbidden_ascii_replaces_and_truncates_by_rune",
			input:     "标题:测试/" + strings.Repeat("中", 100),
			want:      "标题_测试_" + strings.Repeat("中", 74),
			wantRunes: 80,
		},
		{
			name:  "empty_string_returns_empty",
			input: "",
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeFilename(tt.input)
			if got != tt.want {
				t.Errorf("sanitizeFilename() = %q (len %d bytes, %d runes), want %q (len %d bytes, %d runes)",
					got, len(got), utf8.RuneCountInString(got), tt.want, len(tt.want), utf8.RuneCountInString(tt.want))
			}
			if tt.wantRunes > 0 {
				if n := utf8.RuneCountInString(got); n != tt.wantRunes {
					t.Errorf("rune count = %d, want %d", n, tt.wantRunes)
				}
				if !utf8.ValidString(got) {
					t.Errorf("result is not valid UTF-8: %q", got)
				}
			}
		})
	}
}
