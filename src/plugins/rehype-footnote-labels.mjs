import { visit } from "unist-util-visit";
import I18nKey from "../i18n/i18nKey.ts";
import { i18n } from "../i18n/translation.ts";

/**
 * Localize the back-reference label that remark-gfm emits on footnote
 * back-links ("Back to reference N"); the DOM attribute is `aria-label`.
 */
export function rehypeFootnoteLabels() {
	return (tree) => {
		visit(tree, "element", (node) => {
			const props = node.properties;
			if (!props) return;
			const value = props["aria-label"] ?? props.ariaLabel;
			if (typeof value !== "string") return;
			const match = /^Back to reference (\d+)$/.exec(value);
			if (!match) return;
			const localized = i18n(I18nKey.footnoteBackReference).replace(
				"{n}",
				match[1],
			);
			if ("ariaLabel" in props) props.ariaLabel = localized;
			else props["aria-label"] = localized;
		});
	};
}
