package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.GuideBlockView;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The guide / rules body parser.
 *
 * Added 2026-10-03 alongside the structured-body change. This is the first test
 * in this module — it had no test dependency at all before, which is why the
 * parser initially shipped behind nothing but a compile check.
 *
 * The parser is pure string logic with no Spring or database involvement, so it
 * is the one part of that change that can be verified without a running app. The
 * cases below are the ones that would actually bite: a body written the old way
 * (no markers), markers in the middle of a paragraph, a blank heading, CRLF line
 * endings, and two clauses sharing a title.
 */
class GuideServiceBlocksTest {

    private static List<GuideBlockView> blocks(String body) {
        return GuideService.extractBlocks(body);
    }

    @Test
    @DisplayName("a body with no markers yields paragraphs only — so no outline, same as before")
    void noMarkersYieldsParagraphsOnly() {
        List<GuideBlockView> result = blocks("第一段。\n\n第二段。");

        assertThat(result).hasSize(2);
        assertThat(result).allSatisfy(block -> {
            assertThat(block.getType()).isEqualTo("paragraph");
            assertThat(block.getLevel()).isZero();
            assertThat(block.getId()).isNull();
        });
        assertThat(result.get(0).getText()).isEqualTo("第一段。");
    }

    @Test
    @DisplayName("a `## ` line becomes a heading and the marker is stripped")
    void headingMarkerIsStripped() {
        List<GuideBlockView> result = blocks("## 总则\n\n本规则适用于全部公开空间。");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getType()).isEqualTo("heading");
        assertThat(result.get(0).getText()).isEqualTo("总则");
        assertThat(result.get(0).getLevel()).isEqualTo(2);
        assertThat(result.get(0).getId()).isEqualTo("guide-heading-0");

        // The client renders `text` verbatim, so a surviving marker would show up
        // as literal "## " on the page.
        assertThat(result.get(0).getText()).doesNotContain("#");

        assertThat(result.get(1).getType()).isEqualTo("paragraph");
        assertThat(result.get(1).getText()).isEqualTo("本规则适用于全部公开空间。");
    }

    @Test
    @DisplayName("`### ` is a sub-clause at level 3")
    void level3Heading() {
        List<GuideBlockView> result = blocks("### 细则");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getLevel()).isEqualTo(3);
        assertThat(result.get(0).getText()).isEqualTo("细则");
    }

    @Test
    @DisplayName("a heading may sit mid-paragraph; the text before it is flushed as its own block")
    void headingSplitsAParagraph() {
        List<GuideBlockView> result = blocks("前言。\n## 总则\n正文。");

        assertThat(result).hasSize(3);
        assertThat(result.get(0).getText()).isEqualTo("前言。");
        assertThat(result.get(0).getType()).isEqualTo("paragraph");
        assertThat(result.get(1).getType()).isEqualTo("heading");
        assertThat(result.get(1).getText()).isEqualTo("总则");
        assertThat(result.get(2).getText()).isEqualTo("正文。");
    }

    @Test
    @DisplayName("consecutive non-blank lines join into one paragraph")
    void linesJoinIntoOneParagraph() {
        List<GuideBlockView> result = blocks("第一行\n第二行");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getText()).isEqualTo("第一行\n第二行");
    }

    @Test
    @DisplayName("CRLF line endings are handled")
    void handlesCrlf() {
        List<GuideBlockView> result = blocks("## 总则\r\n\r\n正文。");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getText()).isEqualTo("总则");
        assertThat(result.get(1).getText()).isEqualTo("正文。");
    }

    @Test
    @DisplayName("a bare `## ` with no title is not a heading")
    void emptyHeadingIsNotAHeading() {
        // An empty heading would produce an outline entry with a blank label —
        // worse than not listing it.
        List<GuideBlockView> result = blocks("## \n\n正文。");

        assertThat(result).noneSatisfy(block -> assertThat(block.getType()).isEqualTo("heading"));
    }

    @Test
    @DisplayName("headings are anchored by position, so two clauses may share a title")
    void anchorsArePositionalNotTextual() {
        List<GuideBlockView> result = blocks("## 附则\n\n一。\n\n## 附则\n\n二。");

        List<String> ids = result.stream()
                .filter(block -> "heading".equals(block.getType()))
                .map(GuideBlockView::getId)
                .toList();

        assertThat(ids).containsExactly("guide-heading-0", "guide-heading-1");
    }

    @Test
    @DisplayName("a blank or null body yields no blocks")
    void blankBodyYieldsNothing() {
        assertThat(blocks(null)).isEmpty();
        assertThat(blocks("")).isEmpty();
        assertThat(blocks("   \n\n  ")).isEmpty();
    }

    @Test
    @DisplayName("`#` without a space is not a heading")
    void hashWithoutSpaceIsNotAHeading() {
        // Guards against swallowing a line that merely starts with a hash — for
        // example a Markdown-style issue reference.
        List<GuideBlockView> result = blocks("#123 是一个 issue 编号");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getType()).isEqualTo("paragraph");
        assertThat(result.get(0).getText()).isEqualTo("#123 是一个 issue 编号");
    }
}
