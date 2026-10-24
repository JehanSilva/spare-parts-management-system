import re

# A word starts at the beginning of the text or after anything that isn't a
# letter, digit or apostrophe — so "(h4)" -> "(H4)" and "anti-roll" ->
# "Anti-Roll", but "driver's" keeps its "s" and "4wd" its "w". Mirrored by
# frontend/src/components/titleCase.js; keep the two in step.
_WORD_START = re.compile(r"(^|[^A-Za-z0-9'’])([a-z])")


def title_case_name(text):
    """
    Capitalise the first letter of every word in a part name, leaving the rest
    as typed so abbreviations survive ("cabin AC filter" -> "Cabin AC Filter").
    """
    if not text:
        return text
    return _WORD_START.sub(lambda m: m.group(1) + m.group(2).upper(), text.strip())
