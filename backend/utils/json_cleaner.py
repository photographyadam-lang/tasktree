import re

def clean_llm_json(raw_text: str) -> str:
    """Strips Markdown fences or preamble text natively keeping only the isolated array block."""
    # Find the outermost array brackets explicitly
    start_idx = raw_text.find('[')
    end_idx = raw_text.rfind(']')

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        return raw_text[start_idx:end_idx+1]

    # Fallback to general markdown cleaning just in case it maps oddly without typical arrays (e.g., single dicts although schema demands array)
    cleaned = re.sub(r'```json\s*', '', raw_text)
    cleaned = re.sub(r'```\s*', '', cleaned)
    return cleaned.strip()


def clean_llm_json_object(raw_text: str) -> str:
    """Strips Markdown fences or preamble text keeping only the outermost JSON object block."""
    start_idx = raw_text.find('{')
    end_idx = raw_text.rfind('}')

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        return raw_text[start_idx:end_idx+1]

    cleaned = re.sub(r'```json\s*', '', raw_text)
    cleaned = re.sub(r'```\s*', '', cleaned)
    return cleaned.strip()
