import React, { useState, useEffect } from 'react';
import { formatNumberString, deformatNumberString } from '../constants';

interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value: number | string | undefined;
    onChange: (val: number) => void;
    onChangeString?: (val: string) => void;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({ 
    value, 
    onChange, 
    onChangeString, 
    className, 
    ...props 
}) => {
    const [localValue, setLocalValue] = useState<string>('');

    // Keep track of parent changes
    useEffect(() => {
        if (value === undefined || value === null || value === '') {
            setLocalValue('');
        } else {
            const parsedLocal = deformatNumberString(localValue);
            const parsedProp = typeof value === 'number' ? value : deformatNumberString(value.toString());
            // Only update local value if the numeric value actually differs
            if (parsedLocal !== parsedProp || localValue === '') {
                setLocalValue(formatNumberString(value));
            }
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const formatted = formatNumberString(raw);
        setLocalValue(formatted);
        const numeric = deformatNumberString(raw);
        onChange(numeric);
        if (onChangeString) {
            onChangeString(formatted);
        }
    };

    return (
        <input
            type="text"
            className={className}
            value={localValue}
            onChange={handleChange}
            {...props}
        />
    );
};

export default FormattedNumberInput;
