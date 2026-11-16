"""Fast, offline tests:  python -m pytest -q   (or: python tests/test_offline.py)"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from reelbot import music, topics  # noqa: E402
from reelbot.config import load_config  # noqa: E402
from reelbot.pipeline import build_metadata, word_timings  # noqa: E402
from reelbot.render import Word, chunk_words  # noqa: E402
from reelbot.research import _parse_feed, first_sentence  # noqa: E402
from reelbot.script import Line, Script, speakable, visual_for  # noqa: E402
from reelbot.tts import SAMPLE_RATE  # noqa: E402


def test_speakable():
    assert speakable("The S&P 500 rose 1.2%") == "The S and P 500 rose 1.2 percent"
    assert speakable("Nvidia hits $5T") == "Nvidia hits 5 trillion dollars"
    assert speakable("Buy ETFs in your 401(k)") == "Buy E T Fs in your four oh one k"
    assert speakable("costs $1") == "costs 1 dollar"


def test_first_sentence_cleanup():
    s = first_sentence("Compound interest or anatocism is interest on interest. Second sentence here.")
    assert s == "Compound interest is interest on interest."


def test_topics_are_well_formed():
    ids = set()
    for t in topics.TOPICS:
        assert t["id"] not in ids
        ids.add(t["id"])
        assert t["hook"] and len(t["points"]) >= 3 and t["visuals"] and t["niches"]
    for niche in topics.NICHES:
        assert topics.topics_for(niche)


def test_chunking_breaks_on_punctuation():
    words = [Word(w, i, i + 1) for i, w in enumerate("Save money. Then invest it wisely every month".split())]
    chunks = chunk_words(words)
    assert chunks[0] == [0, 1]
    assert all(len(c) <= 3 for c in chunks)


def test_word_timings_cover_audio():
    s = Script("evergreen", "x", "T", "investing", [Line("Hello there world."), Line("Second line.", kind="outro")])
    clips = [np.zeros(SAMPLE_RATE * 2, dtype=np.float32), np.zeros(SAMPLE_RATE, dtype=np.float32)]
    words, spans = word_timings(s, clips)
    assert len(words) == 5
    assert spans[0] == (0.0, 2.0)
    assert words[2].end <= 2.0 + 1e-6
    assert all(w.end > w.start for w in words)


def test_music_and_mix():
    m = music.generate(3.0, seed=1)
    assert len(m) == 3 * SAMPLE_RATE and np.max(np.abs(m)) <= 1.0
    out = music.mix(np.zeros(SAMPLE_RATE, dtype=np.float32), m, 0.2)
    assert np.max(np.abs(out)) <= 1.0


def test_rss_parsing():
    xml = """<rss><channel><item><title>Fed holds rates steady as inflation cools - Reuters</title>
    <pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate><link>https://x</link>
    <description>Fed holds rates steady as inflation cools</description></item></channel></rss>"""
    items = _parse_feed(xml, "Google News")
    assert items[0]["title"] == "Fed holds rates steady as inflation cools"
    assert items[0]["summary"] == ""
    assert visual_for(items[0]["title"], "economy") == "federal reserve building"


def test_metadata():
    cfg = load_config()
    s = Script("evergreen", "x", "Index Funds", "investing", [Line("Hi.")], tags=["index funds"])
    meta = build_metadata(s, ["photo credit"], cfg)
    assert meta["title"].endswith("#Shorts")
    assert "photo credit" in meta["description"] and "Not financial advice" in meta["description"]


def test_phone_app_topics_are_in_sync():
    """app/data/topics.json must match reelbot/topics.py (regenerate: python scripts/export_app_data.py)."""
    import json
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data = json.load(open(os.path.join(root, "app", "data", "topics.json"), encoding="utf-8"))
    assert data["topics"] == topics.TOPICS and data["niches"] == topics.NICHES


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
